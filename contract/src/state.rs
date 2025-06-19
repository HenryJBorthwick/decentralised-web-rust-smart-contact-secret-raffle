use schemars::JsonSchema;
use secret_toolkit::storage::{Item, Keymap};
use serde::{Deserialize, Serialize};
use cosmwasm_std::{CanonicalAddr, Timestamp};

pub static ADMIN_KEY: &[u8] = b"admin";
pub static ADMIN: Item<CanonicalAddr> = Item::new(ADMIN_KEY);

pub static RAFFLE_STARTED_KEY: &[u8] = b"started";
pub static RAFFLE_STARTED: Item<bool> = Item::new(RAFFLE_STARTED_KEY);

pub static PRIZE_CLAIMED_KEY: &[u8] = b"prize_claimed";
pub static PRIZE_CLAIMED: Item<bool> = Item::new(PRIZE_CLAIMED_KEY);

pub static RAFFLE_KEY: &[u8] = b"raffle";
pub static RAFFLE: Item<Raffle> = Item::new(RAFFLE_KEY);

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq, JsonSchema)]
pub struct Raffle {
    pub end_time: Timestamp,
    pub ticket_price: u128,
    pub secret: String,
}

pub static WINNER_SELECTED_KEY: &[u8] = b"winner_selected";
pub static WINNER_SELECTED: Item<bool> = Item::new(WINNER_SELECTED_KEY);

pub static WINNER_KEY: &[u8] = b"winner";
pub static WINNER: Item<Option<CanonicalAddr>> = Item::new(WINNER_KEY);

pub static TOTAL_TICKETS_KEY: &[u8] = b"total_tickets";
pub static TOTAL_TICKETS: Item<u64> = Item::new(TOTAL_TICKETS_KEY);

pub static TICKETS_KEY: &[u8] = b"tickets";
pub static TICKETS: Keymap<CanonicalAddr, u64> = Keymap::new(TICKETS_KEY);

// NOTE: We store ticket counts keyed by canonical addresses so we can
// compare/query efficiently without worrying about Bech32 casing.  Do not
// switch to human-readable `Addr` without normalising first, otherwise duplicate
// entries for the same wallet could occur (e.g. `secret1...` vs `SECRET1...`).
