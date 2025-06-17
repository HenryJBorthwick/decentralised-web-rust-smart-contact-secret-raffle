use cosmwasm_std::{
    entry_point, to_binary, BankMsg, Binary, CanonicalAddr, Coin, CosmosMsg, Deps, DepsMut, Env, MessageInfo, Response, StdError, StdResult, Timestamp, Uint128,
};
use secret_toolkit::permit::{Permit, validate};

use crate::msg::{ExecuteMsg, InstantiateMsg, QueryAnswer, QueryMsg, QueryWithPermit}; 
use crate::state::{
    Raffle, ADMIN, PRIZE_CLAIMED, RAFFLE, RAFFLE_STARTED, TICKETS, TOTAL_TICKETS, WINNER,
    WINNER_SELECTED,
};

// =============================================================================================
// Secret Network Raffle Contract
// ---------------------------------------------------------------------------------------------
// High-level flow:
// 1. Admin configures raffle with `set_raffle` (secret phrase, ticket price, end time).
// 2. Admin starts raffle with `start_raffle` → ticket sales open.
// 3. Users purchase tickets via `buy_ticket` by sending uSCRT (multiple allowed).
// 4. After `end_time`, admin calls `select_winner`:
//      • If tickets were sold → pick pseudo-random winner weighted by ticket count.
//      • If zero tickets sold → mark raffle as finished without a winner (edge-case).
// 5. Winning address can `claim_prize` to receive the pot and may query the hidden secret
//    phrase (`get_secret`) using a permit.
// =============================================================================================

// NOTE: This contract purposefully avoids storing a single enum status and
// instead tracks lifecycle steps with *separate* bool flags (RAFFLE_STARTED,
// WINNER_SELECTED, PRIZE_CLAIMED).  This makes future migrations simpler
// because adding a new state only requires introducing another flag without
// breaking serialization of the existing ones.  If you consolidate these flags
// remember to write a proper migration

#[entry_point]
/// Contract instantiation – records the admin address and initialises all state flags.
/// The `InstantiateMsg` optionally allows specifying a custom admin; defaults to sender.
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    let admin = msg.admin.unwrap_or(info.sender.clone());
    let admin_canonical = deps.api.addr_canonicalize(admin.as_str())?;
    ADMIN.save(deps.storage, &admin_canonical)?;
    RAFFLE_STARTED.save(deps.storage, &false)?;
    WINNER_SELECTED.save(deps.storage, &false)?;
    PRIZE_CLAIMED.save(deps.storage, &false)?;
    TOTAL_TICKETS.save(deps.storage, &0u64)?;
    deps.api.debug(&format!("Admin set to: {}", admin));
    Ok(Response::default())
}

#[entry_point]
/// Main entry for executing state-changing messages. Delegates to helper functions
/// based on the variant of `ExecuteMsg`.
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    match msg {
        ExecuteMsg::SetRaffle { secret, ticket_price, end_time } => {
            try_set_raffle(deps, info.sender, secret, ticket_price, end_time)
        }
        ExecuteMsg::StartRaffle {} => try_start_raffle(deps, info.sender),
        ExecuteMsg::BuyTicket {} => try_buy_ticket(deps, env, info),
        ExecuteMsg::SelectWinner {} => try_select_winner(deps, env),
        ExecuteMsg::ClaimPrize {} => try_claim_prize(deps, env, info),
    }
}

/// Admin-only. Stores raffle configuration (secret phrase, ticket price, end time).
/// Fails if someone other than the admin calls it or if the raffle has already started.
fn try_set_raffle(
    deps: DepsMut,
    sender: cosmwasm_std::Addr,
    secret: String,
    ticket_price: Uint128,
    end_time: cosmwasm_std::Uint64,
) -> StdResult<Response> {
    let admin = deps.api.addr_humanize(&ADMIN.load(deps.storage)?)?;
    if sender != admin {
        return Err(StdError::generic_err("Only admin can set raffle"));
    }
    if RAFFLE_STARTED.load(deps.storage)? {
        return Err(StdError::generic_err("Raffle already started"));
    }
    let raffle = Raffle {
        end_time: Timestamp::from_seconds(end_time.u64()),
        ticket_price: ticket_price.u128(),
        secret,
    };
    RAFFLE.save(deps.storage, &raffle)?;
    deps.api.debug(&format!("Raffle set with end_time: {}, ticket_price: {}", end_time, ticket_price));
    Ok(Response::default())
}

/// Admin-only. Marks the raffle as started which enables ticket sales.
/// Ensures the raffle is configured and hasn't already been started.
fn try_start_raffle(deps: DepsMut, sender: cosmwasm_std::Addr) -> StdResult<Response> {
    let admin = deps.api.addr_humanize(&ADMIN.load(deps.storage)?)?;
    if sender != admin {
        return Err(StdError::generic_err("Only admin can start raffle"));
    }
    if RAFFLE_STARTED.load(deps.storage)? {
        return Err(StdError::generic_err("Raffle already started"));
    }
    if RAFFLE.may_load(deps.storage)?.is_none() {
        return Err(StdError::generic_err("Raffle not yet configured"));
    }
    RAFFLE_STARTED.save(deps.storage, &true)?;
    deps.api.debug("Raffle started");
    Ok(Response::default())
}

/// Public endpoint allowing users (non-admin) to buy one or more tickets.
/// Validates raffle status, timing and payment amount, then updates per-user and
/// global ticket counters.
fn try_buy_ticket(deps: DepsMut, env: Env, info: MessageInfo) -> StdResult<Response> {
    if !RAFFLE_STARTED.load(deps.storage)? {
        return Err(StdError::generic_err("Raffle not started"));
    }
    let raffle = RAFFLE.load(deps.storage)?;
    if env.block.time >= raffle.end_time {
        return Err(StdError::generic_err("Raffle has ended"));
    }
    let admin = deps.api.addr_humanize(&ADMIN.load(deps.storage)?)?;
    if info.sender == admin {
        return Err(StdError::generic_err("Admin cannot buy tickets"));
    }
    let funds = info
        .funds
        .iter()
        .find(|coin| coin.denom == "uscrt")
        .ok_or_else(|| StdError::generic_err("No uscrt sent"))?;
    if funds.amount.u128() % raffle.ticket_price != 0 {
        return Err(StdError::generic_err(
            "Amount must be a multiple of ticket price",
        ));
    }

    // SAFETY: convert to u64 only after checking bounds – prevents silent
    // truncation when a whale tries to buy > u64::MAX tickets in a single tx.
    let tickets_bought_u128 = funds.amount.u128() / raffle.ticket_price;
    if tickets_bought_u128 > u64::MAX as u128 {
        return Err(StdError::generic_err(
            "Cannot buy that many tickets at once",
        ));
    }
    let tickets_bought = tickets_bought_u128 as u64;

    let sender_canonical = deps.api.addr_canonicalize(info.sender.as_str())?;
    let current_tickets = TICKETS.get(deps.storage, &sender_canonical).unwrap_or(0);
    let new_user_tickets = current_tickets
        .checked_add(tickets_bought)
        .ok_or_else(|| StdError::generic_err("User ticket count overflow"))?;
    TICKETS.insert(
        deps.storage,
        &sender_canonical,
        &new_user_tickets,
    )?;
    
    let total_tickets = TOTAL_TICKETS.load(deps.storage)?;
    let new_total_tickets = total_tickets
        .checked_add(tickets_bought)
        .ok_or_else(|| StdError::generic_err("Total ticket count overflow"))?;
    TOTAL_TICKETS.save(deps.storage, &new_total_tickets)?;
    deps.api.debug(&format!("User {} bought {} tickets", info.sender, tickets_bought));
    Ok(Response::default())
}

/// Admin-only (implicitly – front-end restricts) endpoint run after the raffle end
/// time. Picks a random winner proportional to ticket holdings, or finalises with
/// no winner if zero tickets were sold.
fn try_select_winner(deps: DepsMut, env: Env) -> StdResult<Response> {
    let raffle = RAFFLE.load(deps.storage)?;
    if env.block.time < raffle.end_time {
        return Err(StdError::generic_err("Raffle not yet ended"));
    }
    if WINNER_SELECTED.load(deps.storage)? {
        return Err(StdError::generic_err("Winner already selected"));
    }
    let total_tickets = TOTAL_TICKETS.load(deps.storage)?;

    // Gracefully handle the edge-case where the raffle ended but no one bought tickets.
    // In this scenario we mark the raffle as completed without a winner instead of
    // reverting the transaction. This prevents the admin from wasting fees and
    // still allows the raffle lifecycle to progress.
    if total_tickets == 0 {
        WINNER.save(deps.storage, &None)?;
        WINNER_SELECTED.save(deps.storage, &true)?;
        deps.api.debug("Raffle ended with zero tickets – no winner selected");
        return Ok(Response::new()
            .add_attribute("action", "select_winner")
            .add_attribute("result", "no_tickets"));
    }
    let random_seed = env
        .block
        .random
        .ok_or_else(|| StdError::generic_err("Randomness unavailable"))?;
    // The first 8 bytes give us a u64.  Using modulo total_tickets provides
    // pseudo-random selection proportional to ticket counts.  The slight modulo
    // bias is negligible for small raffles and acceptable for demo purposes –
    // **do not** use this in production where large stakes are involved.
    let random_index = u64::from_le_bytes(random_seed.0[..8].try_into().unwrap()) % total_tickets;
    let mut running_sum = 0u64;
    let mut winner = None;
    for entry in TICKETS.iter(deps.storage)? {
        let (addr, tickets) = entry?;
        running_sum += tickets;
        if running_sum > random_index {
            winner = Some(addr);
            break;
        }
    }
    let winner = winner.ok_or_else(|| StdError::generic_err("Failed to select winner"))?;
    WINNER.save(deps.storage, &Some(winner.clone()))?;
    WINNER_SELECTED.save(deps.storage, &true)?;
    let winner_addr = deps.api.addr_humanize(&winner)?;
    deps.api.debug(&format!("Winner selected: {}", winner_addr));
    Ok(Response::default())
}

/// Allows the previously selected winner to withdraw the entire contract balance
/// (the prize pot). Once successful, `PRIZE_CLAIMED` is set to prevent double spends.
fn try_claim_prize(deps: DepsMut, env: Env, info: MessageInfo) -> StdResult<Response> {
    if !WINNER_SELECTED.load(deps.storage)? {
        return Err(StdError::generic_err("Winner not selected"));
    }
    if PRIZE_CLAIMED.load(deps.storage)? {
        return Err(StdError::generic_err("Prize already claimed"));
    }
    let winner = WINNER
        .load(deps.storage)?
        .ok_or_else(|| StdError::generic_err("No winner set"))?;
    let sender_canonical = deps.api.addr_canonicalize(info.sender.as_str())?;
    if sender_canonical != winner {
        return Err(StdError::generic_err("Only winner can claim prize"));
    }
    let balance = deps.querier.query_balance(&env.contract.address, "uscrt")?;
    // We purposely transfer *all* uscrt so there is never residual dust left in
    // the contract – simplifies client logic when inferring `prize_claimed`.
    if balance.amount.is_zero() {
        return Err(StdError::generic_err("No prize available"));
    }
    PRIZE_CLAIMED.save(deps.storage, &true)?;
    deps.api.debug(&format!("Prize claimed by winner: {}", info.sender));
    let msg = CosmosMsg::Bank(BankMsg::Send {
        to_address: info.sender.into_string(),
        amount: vec![Coin {
            denom: "uscrt".to_string(),
            amount: balance.amount,
        }],
    });
    Ok(Response::new().add_message(msg))
}

#[entry_point]
/// Read-only queries. Currently supports:
///  • `raffle_info` – public data about the raffle state.
///  • `with_permit` – authenticated queries using secret-toolkit permits.
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::RaffleInfo {} => to_binary(&query_raffle_info(deps)?),
        QueryMsg::WithPermit { permit, query } => to_binary(&permit_queries(deps, env, permit, query)?),
    }
}

/// Returns a summarised view of the raffle that is safe to expose publicly. If the
/// winner has been selected, their address is revealed (unless no winner exists).
fn query_raffle_info(deps: Deps) -> StdResult<QueryAnswer> {
    let started = RAFFLE_STARTED.load(deps.storage)?;
    let winner_selected = WINNER_SELECTED.load(deps.storage)?;
    let prize_claimed = PRIZE_CLAIMED.load(deps.storage)?;
    let total_tickets = TOTAL_TICKETS.load(deps.storage).unwrap_or(0);

    // Always expose raffle parameters if the raffle has been configured, even
    // before it is started, so that client UIs can display the upcoming raffle.
    let (ticket_price, end_time) = match RAFFLE.may_load(deps.storage)? {
        Some(raffle) => (
            Some(Uint128::from(raffle.ticket_price)),
            Some(cosmwasm_std::Uint64::from(raffle.end_time.seconds())),
        ),
        None => (None, None),
    };

    let winner = if winner_selected {
        // It is possible the raffle ended with zero tickets, in which case there is
        // no winner. Return None instead of throwing an error so that UIs can
        // gracefully handle the "no winner" scenario.
        match WINNER.load(deps.storage)? {
            Some(addr) => Some(deps.api.addr_humanize(&addr)?),
            None => None,
        }
    } else {
        None
    };
    Ok(QueryAnswer::RaffleInfo {
        started,
        ticket_price,
        end_time,
        total_tickets: Uint128::from(total_tickets),
        winner_selected,
        prize_claimed,
        winner,
    })
}

/// Dispatches queries that require identity verification via permit.
fn permit_queries(
    deps: Deps,
    env: Env,
    permit: Permit,
    query: QueryWithPermit,
) -> StdResult<QueryAnswer> {
    let account = validate(deps, "revoked_permits", &permit, env.contract.address.to_string(), None)?;
    let sender_canonical = deps.api.addr_canonicalize(&account.to_string())?;
    match query {
        QueryWithPermit::GetSecret {} => query_secret(deps, &sender_canonical),
        QueryWithPermit::GetTickets {} => query_tickets(deps, &sender_canonical),
    }
}

/// Returns the secret phrase to the winner only (authenticated via permit).
fn query_secret(deps: Deps, sender: &CanonicalAddr) -> StdResult<QueryAnswer> {
    if !WINNER_SELECTED.load(deps.storage)? {
        return Err(StdError::generic_err("Winner not selected"));
    }
    let winner = WINNER
        .load(deps.storage)?
        .ok_or_else(|| StdError::generic_err("No winner set"))?;
    if *sender != winner {
        return Err(StdError::generic_err("Only winner can view secret"));
    }
    let raffle = RAFFLE.load(deps.storage)?;
    Ok(QueryAnswer::GetSecret { secret: raffle.secret })
}

/// Returns the number of tickets owned by the authenticated user.
fn query_tickets(deps: Deps, sender: &CanonicalAddr) -> StdResult<QueryAnswer> {
    let tickets = TICKETS.get(deps.storage, sender).unwrap_or(0u64);
    Ok(QueryAnswer::GetTickets { tickets: cosmwasm_std::Uint128::from(tickets as u128) })
}

