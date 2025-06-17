use cosmwasm_std::{Addr, Uint128, Uint64};
use schemars::JsonSchema;
use secret_toolkit::permit::Permit;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub admin: Option<Addr>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    // Admin-only
    SetRaffle {
        secret: String,
        ticket_price: Uint128,
        end_time: Uint64,
    },
    StartRaffle {},

    // Any user
    BuyTicket {},
    SelectWinner {},
    ClaimPrize {},
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    RaffleInfo {},
    WithPermit {
        /// permit used to verify querier identity
        permit: Permit,
        /// query to perform
        query: QueryWithPermit,
    },
}

/// queries using permits
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryWithPermit {
    GetSecret { },
    GetTickets { },
}

// When creating a permit client-side you **must** include the `owner`
// permission in `allowed_permissions`; otherwise the contract will reject the
// query.  See `query_with_permit` validation logic in contract.rs.

#[derive(Serialize, Deserialize, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum QueryAnswer {
    RaffleInfo {
        started: bool,
        ticket_price: Option<Uint128>,
        end_time: Option<Uint64>,
        total_tickets: Uint128,
        winner_selected: bool,
        prize_claimed: bool,
        winner: Option<Addr>,
    },
    GetSecret {
        secret: String,
    },
    GetTickets {
        tickets: Uint128,
    },
}
