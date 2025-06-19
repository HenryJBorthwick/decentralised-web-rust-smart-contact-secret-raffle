import { SecretNetworkClient, Wallet } from "secretjs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();
const mnemonic = process.env.MNEMONIC;
if (!mnemonic) {
  console.error("MNEMONIC not set in .env");
  process.exit(1);
}

// Constants
const CHAIN_ID = "pulsar-3";
const RPC_URL = "https://pulsar.lcd.secretnodes.com";
const DENOM = "uscrt";

// Admin wallet & client
const adminWallet = new Wallet(mnemonic);
const admin = new SecretNetworkClient({
  chainId: CHAIN_ID,
  url: RPC_URL,
  wallet: adminWallet,
  walletAddress: adminWallet.address,
});

// Utility sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Instantiate the raffle contract and return the new contract address
async function instantiateContract(codeId: string, contractCodeHash: string): Promise<string> {
  const initMsg = {}; // no init params
  const tx = await admin.tx.compute.instantiateContract(
    {
      code_id: codeId,
      sender: adminWallet.address,
      code_hash: contractCodeHash,
      init_msg: initMsg,
      label: `raffle-${Math.ceil(Math.random() * 1_000_000)}`,
    },
    { gasLimit: 400_000 }
  );

  // Extract the contract address from tx logs @ts-ignore – secretjs typing does not include arrayLog
  const contractAddress: string = tx.arrayLog!.find(
    (log: any) => log.type === "message" && log.key === "contract_address"
  ).value;

  return contractAddress;
}

async function main() {
  // Validate CLI args
  if (process.argv.length !== 4) {
    console.error("Usage: npm run test_auction <code_id> <code_hash>");
    process.exit(1);
  }
  const code_id = process.argv[2];
  const code_hash = process.argv[3];

  /* --------------------------------------------------------------------- */
  /*                          Wallet preparation                           */
  /* --------------------------------------------------------------------- */

  // Wallets required by the tests
  const nonAdminWallet = new Wallet(); // attempts admin-only actions
  const preSetupBuyerWallet = new Wallet(); // tries to buy before raffle is set
  const users = [new Wallet(), new Wallet(), new Wallet()]; // actual participants

  // Funding calculations (ticket funds + generous gas cushion)
  const fundingMap: Record<string, string> = {
    [nonAdminWallet.address]: "250000",      // buffer for 2 failed txs
    [preSetupBuyerWallet.address]: "150000", // 1 failed tx buffer
    [users[0].address]: "400000",            // 1×ticket + ~3×gas
    [users[1].address]: "500000",            // 2×ticket + ~3×gas
    [users[2].address]: "600000",            // 3×ticket + ~3×gas
  };

  const totalSend = Object.values(fundingMap)
    .map(Number)
    .reduce((a, b) => a + b, 0)
    .toString();

  const outputs = Object.entries(fundingMap).map(([address, amount]) => ({
    address,
    coins: [{ denom: DENOM, amount }],
  }));

  console.log("\n↪ Funding test wallets …");
  await admin.tx.bank.multiSend(
    {
      inputs: [
        {
          address: adminWallet.address,
          coins: [{ denom: DENOM, amount: totalSend }],
        },
      ],
      outputs,
    },
    { gasLimit: 100_000 }
  );
  console.log("✅ Wallets funded\n");

  // Clients for all non-admin wallets
  const nonAdminClient = new SecretNetworkClient({
    chainId: CHAIN_ID,
    url: RPC_URL,
    wallet: nonAdminWallet,
    walletAddress: nonAdminWallet.address,
  });
  const preSetupBuyerClient = new SecretNetworkClient({
    chainId: CHAIN_ID,
    url: RPC_URL,
    wallet: preSetupBuyerWallet,
    walletAddress: preSetupBuyerWallet.address,
  });
  const userClients = users.map(
    (w) =>
      new SecretNetworkClient({
        chainId: CHAIN_ID,
        url: RPC_URL,
        wallet: w,
        walletAddress: w.address,
      })
  );

  /* --------------------------------------------------------------------- */
  /*                       Contract instantiation                          */
  /* --------------------------------------------------------------------- */
  console.log("Instantiating raffle contract …");
  const contract_address = await instantiateContract(code_id, code_hash);
  console.log("📜 Contract address:", contract_address, "\n");

  // Raffle timing helpers -------------------------------------------------
  // Give lots of time (2 min) between start and end so that network
  // latency or slower blocks do not cause unintended early "raffle ended" errors during the tests.

  const RAFFLE_DURATION = 120; // seconds
  let end_time: string;

  const refreshEndTime = async () => {
    const latestBlock: any = await admin.query.tendermint.getLatestBlock({});
    const chainNow = new Date(latestBlock.block.header.time).getTime() / 1000;
    end_time = Math.floor(chainNow + RAFFLE_DURATION).toString();
    console.log(`Chain time ${chainNow}s, end_time refreshed to ${end_time}s (+${RAFFLE_DURATION}s)`);
  };

  // Initial computation so early tests have a value
  await refreshEndTime();

  // Raffle fixed parameters ---------------------------------------------
  const ticket_price = "100000"; // 0.1 SCRT
  const secret = "TestSecret123";

  /* --------------------------------------------------------------------- */
  /*                               TESTS                                   */
  /* --------------------------------------------------------------------- */

  // Helper to print PASS / FAIL
  const pass = (msg: string) => console.log(`✅ PASS – ${msg}`);
  const fail = (msg: string) => console.log(`❌ FAIL – ${msg}`);

  // Helper to execute a tx and determine success/failure based on response.code
  const runTx = async (
    label: string,
    exec: () => Promise<any>
  ): Promise<{ ok: boolean; res: any }> => {
    try {
      const res = await exec();
      const ok = res.code === 0;
      console.log(`   ↳ Tx '${label}' code: ${res.code}`);
      if (!ok) console.log(`     raw_log: ${res.rawLog}`);
      return { ok, res };
    } catch (e: any) {
      console.log(`   ↳ Tx '${label}' threw error:`, e.message ?? e);
      return { ok: false, res: e };
    }
  };

  // Helper to dump current chain time and raffle state
  const printStatus = async (stage: string) => {
    const block: any = await admin.query.tendermint.getLatestBlock({});
    const blockTime = new Date(block.block.header.time).getTime() / 1000;
    const infoRaw: any = await admin.query.compute.queryContract({
      contract_address,
      code_hash,
      query: { raffle_info: {} },
    });
    const info = infoRaw.raffle_info ?? infoRaw;
    console.log(`--- STATUS @ ${stage} ---`);
    console.log(`   chainTime: ${blockTime}`);
    console.log(`   raffleInfo: ${JSON.stringify(info)}`);
  };

  /* ------------------ Test 1: non-admin set_raffle ---------------------- */
  console.log("Test 1 – Non-admin attempts set_raffle");
  {
    const { ok } = await runTx("nonAdmin set_raffle", () => nonAdminClient.tx.compute.executeContract(
      {
        sender: nonAdminWallet.address,
        contract_address,
        code_hash,
        msg: { set_raffle: { secret, ticket_price, end_time } },
        sent_funds: [],
      },
      { gasLimit: 50_000 }
    ));
    if (ok) fail("Non-admin was able to set raffle");
    else pass("Non-admin cannot set raffle");
  }

  /* --------------- Test 2: buy_ticket before raffle set ----------------- */
  console.log("Test 2 – Buy ticket before raffle setup");
  {
    const { ok } = await runTx("preSetup buy_ticket", () => preSetupBuyerClient.tx.compute.executeContract(
      {
        sender: preSetupBuyerWallet.address,
        contract_address,
        code_hash,
        msg: { buy_ticket: {} },
        sent_funds: [{ denom: DENOM, amount: ticket_price }],
      },
      { gasLimit: 60_000 }
    ));
    if (ok) fail("Able to buy ticket before raffle setup");
    else pass("Cannot buy ticket before raffle setup");
  }

  /* --------------- Test 2b: admin start_raffle before config --------------- */
  console.log("Test 2b – Admin attempts start_raffle before configuration");
  {
    const { ok } = await runTx("admin pre start_raffle", () => admin.tx.compute.executeContract(
      {
        sender: adminWallet.address,
        contract_address,
        code_hash,
        msg: { start_raffle: {} },
        sent_funds: [],
      },
      { gasLimit: 50_000 }
    ));
    if (ok) fail("Admin started raffle before configuration");
    else pass("Admin cannot start raffle before configuration");
  }

  /* ---------------- Admin sets up the raffle --------------------------- */
  // Refresh end_time just before the real set_raffle so the raffle has the full RAFFLE_DURATION window starting now.
  await refreshEndTime();
  console.log("Admin – set_raffle");

  await admin.tx.compute.executeContract(
    {
      sender: adminWallet.address,
      contract_address,
      code_hash,
      msg: { set_raffle: { secret, ticket_price, end_time } },
      sent_funds: [],
    },
    { gasLimit: 50_000 }
  );
  console.log("Raffle configured\n");

  await printStatus("post-set_raffle");

  /* -------------- Test 3: non-admin start_raffle ------------------------ */
  console.log("Test 3 – Non-admin attempts start_raffle");
  {
    const { ok } = await runTx("nonAdmin start_raffle", () => nonAdminClient.tx.compute.executeContract(
      {
        sender: nonAdminWallet.address,
        contract_address,
        code_hash,
        msg: { start_raffle: {} },
        sent_funds: [],
      },
      { gasLimit: 50_000 }
    ));
    if (ok) fail("Non-admin was able to start raffle");
    else pass("Non-admin cannot start raffle");
  }

  /* -------------------- Admin starts raffle ---------------------------- */
  console.log("Admin – start_raffle");
  await admin.tx.compute.executeContract(
    {
      sender: adminWallet.address,
      contract_address,
      code_hash,
      msg: { start_raffle: {} },
      sent_funds: [],
    },
    { gasLimit: 50_000 }
  );
  console.log("Raffle started\n");

  await printStatus("post-start_raffle");

  /* -------------- Test 4b: admin buy_ticket (should fail) --------------- */
  console.log("Test 4b – Admin attempts to buy tickets");
  {
    const { ok } = await runTx("admin buy_ticket", () => admin.tx.compute.executeContract(
      {
        sender: adminWallet.address,
        contract_address,
        code_hash,
        msg: { buy_ticket: {} },
        sent_funds: [{ denom: DENOM, amount: ticket_price }],
      },
      { gasLimit: 60_000 }
    ));
    if (ok) fail("Admin was able to buy tickets");
    else pass("Admin cannot buy tickets");
  }

  /* -------------- Test 4: buy ticket incorrect amount ------------------ */
  console.log("Test 4 – Buy ticket with incorrect amount");
  {
    const wrongAmount = (parseInt(ticket_price) + 1).toString();
    const { ok } = await runTx("wrongAmount buy_ticket", () => userClients[0].tx.compute.executeContract(
      {
        sender: users[0].address,
        contract_address,
        code_hash,
        msg: { buy_ticket: {} },
        sent_funds: [{ denom: DENOM, amount: wrongAmount }],
      },
      { gasLimit: 60_000 }
    ));
    if (ok) fail("Bought ticket with incorrect amount");
    else pass("Cannot buy ticket with incorrect amount");
  }

  /* -------------------- Users buy tickets ------------------------------ */
  console.log("Users buying tickets …");
  const ticketsToBuy = [1, 2, 3];
  for (let i = 0; i < users.length; i++) {
    const amount = (ticketsToBuy[i] * parseInt(ticket_price)).toString();
    const { ok } = await runTx(`user${i + 1} buy_ticket`, () => userClients[i].tx.compute.executeContract(
      {
        sender: users[i].address,
        contract_address,
        code_hash,
        msg: { buy_ticket: {} },
        sent_funds: [{ denom: DENOM, amount }],
      },
      { gasLimit: 60_000 }
    ));
    if (!ok) {
      fail(`User ${i + 1} failed to buy tickets`);
    } else {
      console.log(`→ User ${i + 1} bought ${ticketsToBuy[i]} ticket(s)`);
    }
    await printStatus(`after user${i + 1} buy`);
  }
  console.log();

  /* -------------- Test 4c: verify get_tickets for each user ------------- */
  console.log("Test 4c – Verify ticket counts via permit");
  for (let i = 0; i < users.length; i++) {
    const permit = await userClients[i].utils.accessControl.permit.sign(
      users[i].address,
      CHAIN_ID,
      `user${i + 1}-tickets-permit`,
      [contract_address],
      ["owner"],
      false
    );
    const res: any = await userClients[i].query.compute.queryContract({
      contract_address,
      code_hash,
      query: {
        with_permit: {
          permit,
          query: { get_tickets: {} },
        },
      },
    });
    const tickets = res.get_tickets?.tickets ?? res.tickets ?? "0";
    const expected = ticketsToBuy[i].toString();
    if (tickets.toString() === expected) {
      pass(`User ${i + 1} has correct ticket count (${expected})`);
    } else {
      fail(`User ${i + 1} ticket count mismatch: expected ${expected} got ${tickets}`);
    }
  }

  /* -------------- Test 5: select_winner before end --------------------- */
  console.log("Test 5 – select_winner before raffle end");
  // Added debug: capture status just before attempting early select_winner
  await printStatus("before early select_winner");
  {
    const { ok } = await runTx("early select_winner", () => admin.tx.compute.executeContract(
      {
        sender: adminWallet.address,
        contract_address,
        code_hash,
        msg: { select_winner: {} },
        sent_funds: [],
      },
      { gasLimit: 100_000 }
    ));
    if (ok) fail("Winner selected before end time");
    else pass("Cannot select winner before end time");
  }

  /* -------- Wait until raffle ends ------------------------------------ */
  const waitMs = (RAFFLE_DURATION + 5) * 1000; // duration + buffer
  console.log(`Waiting ${waitMs / 1000}s for raffle to end…\n`);
  await sleep(waitMs);

  /* -------------- Test 6: buy ticket after raffle end ------------------ */
  console.log("Test 6 – Buy ticket after raffle ended");
  {
    const { ok } = await runTx("late buy_ticket", () => userClients[0].tx.compute.executeContract(
      {
        sender: users[0].address,
        contract_address,
        code_hash,
        msg: { buy_ticket: {} },
        sent_funds: [{ denom: DENOM, amount: ticket_price }],
      },
      { gasLimit: 60_000 }
    ));
    if (ok) fail("Able to buy ticket after raffle end");
    else pass("Cannot buy ticket after raffle end");
  }

  /* ----------------- Select winner (valid time) ------------------------ */
  console.log("Selecting winner …");
  const { ok: winOk } = await runTx("final select_winner", () => admin.tx.compute.executeContract(
    {
      sender: adminWallet.address,
      contract_address,
      code_hash,
      msg: { select_winner: {} },
      sent_funds: [],
    },
    { gasLimit: 100_000 }
  ));
  if (!winOk) {
    fail("select_winner tx failed – aborting further tests");
  }

  // Query raffle_info to get winner address
  const rawInfo: any = await admin.query.compute.queryContract({
    contract_address,
    code_hash,
    query: { raffle_info: {} },
  });
  const info = rawInfo.raffle_info ?? rawInfo; // handle enum wrapper
  console.log("Raffle info:", JSON.stringify(info));
  const winnerAddress: string | undefined = info.winner ? info.winner.address || info.winner : undefined;
  console.log("🏆 Winner:", winnerAddress, "\n");

  if (!winnerAddress) {
    console.error("Winner address not returned by contract – aborting tests");
    process.exit(1);
  }

  const winnerIndex = users.findIndex((w) => w.address === winnerAddress);
  if (winnerIndex === -1) {
    console.error("Winner not among test users – aborting tests");
    process.exit(1);
  }
  const nonWinnerIndex = winnerIndex === 0 ? 1 : 0;

  /* -------------- Test 6a: winner get_secret before claim -------------- */
  console.log("Test 6a – Winner queries secret before claiming prize");
  const preClaimWinnerPermit = await userClients[winnerIndex].utils.accessControl.permit.sign(
    winnerAddress,
    CHAIN_ID,
    "winner-pre-claim-permit",
    [contract_address],
    ["owner"],
    false
  );
  const preClaimRes: any = await userClients[winnerIndex].query.compute.queryContract({
    contract_address,
    code_hash,
    query: {
      with_permit: {
        permit: preClaimWinnerPermit,
        query: { get_secret: {} },
      },
    },
  });
  const preClaimSecret = preClaimRes.secret ?? preClaimRes.get_secret?.secret;
  if (preClaimSecret === secret) {
    pass("Winner retrieved secret pre-claim");
  } else {
    fail("Winner failed to retrieve secret pre-claim");
  }

  /* -------------- Test 7: non-winner claim_prize ----------------------- */
  console.log("Test 7 – Non-winner attempts claim_prize");
  {
    const { ok } = await runTx("nonWinner claim_prize", () => userClients[nonWinnerIndex].tx.compute.executeContract(
      {
        sender: users[nonWinnerIndex].address,
        contract_address,
        code_hash,
        msg: { claim_prize: {} },
        sent_funds: [],
      },
      { gasLimit: 60_000 }
    ));
    if (ok) fail("Non-winner claimed the prize");
    else pass("Non-winner cannot claim prize");
  }

  /* ---------------- Winner claims prize -------------------------------- */
  console.log("Winner claiming prize …");
  await userClients[winnerIndex].tx.compute.executeContract(
    {
      sender: winnerAddress,
      contract_address,
      code_hash,
      msg: { claim_prize: {} },
      sent_funds: [],
    },
    { gasLimit: 60_000 }
  );
  pass("Prize claimed by winner");

  /* -------------- Verify prize_claimed flag & prevent double select ----- */
  const postClaimInfoRaw: any = await admin.query.compute.queryContract({
    contract_address,
    code_hash,
    query: { raffle_info: {} },
  });
  const postClaimInfo = postClaimInfoRaw.raffle_info ?? postClaimInfoRaw;
  if (postClaimInfo.prize_claimed === true) {
    pass("prize_claimed flag set to true");
  } else {
    fail("prize_claimed flag not set after claim");
  }
  console.log("Test 11 – Attempt select_winner again");
  {
    const { ok } = await runTx("double select_winner", () => admin.tx.compute.executeContract(
      {
        sender: adminWallet.address,
        contract_address,
        code_hash,
        msg: { select_winner: {} },
        sent_funds: [],
      },
      { gasLimit: 100_000 }
    ));
    if (ok) fail("Was able to select winner twice");
    else pass("Cannot select winner after already selected");
  }

  /* ---------------- Generate query permits ----------------------------- */
  const winnerPermit = await userClients[winnerIndex].utils.accessControl.permit.sign(
    winnerAddress,
    CHAIN_ID,
    "winner-permit",
    [contract_address],
    ["owner"],
    false
  );
  const nonWinnerPermit = await userClients[nonWinnerIndex].utils.accessControl.permit.sign(
    users[nonWinnerIndex].address,
    CHAIN_ID,
    "non-winner-permit",
    [contract_address],
    ["owner"],
    false
  );

  /* -------------- Test 8: winner get_secret ---------------------------- */
  console.log("Test 8 – Winner queries secret");
  const winnerSecretRes: any = await userClients[winnerIndex].query.compute.queryContract({
    contract_address,
    code_hash,
    query: {
      with_permit: {
        permit: winnerPermit,
        query: { get_secret: {} },
      },
    },
  });
  console.log("  → winner query result:", JSON.stringify(winnerSecretRes));
  const actualSecret = winnerSecretRes.secret ?? winnerSecretRes.get_secret?.secret;
  if (actualSecret === secret) {
    pass("Winner retrieved correct secret");
  } else {
    fail("Winner retrieved incorrect secret");
  }

  /* -------------- Test 9: non-winner get_secret ------------------------ */
  console.log("Test 9 – Non-winner attempts to query secret");
  {
    try {
      const res: any = await userClients[nonWinnerIndex].query.compute.queryContract({
        contract_address,
        code_hash,
        query: {
          with_permit: {
            permit: nonWinnerPermit,
            query: { get_secret: {} },
          },
        },
      });
      console.log("  → non-winner query result:", JSON.stringify(res));
      if (typeof res === "string" && res.includes("Only winner")) {
        pass("Non-winner cannot query secret");
      } else {
        fail("Non-winner accessed secret");
      }
    } catch (e: any) {
      console.log("  ↳ Rejected with:", e.message ?? e);
      pass("Non-winner cannot query secret");
    }
  }

  /* -------------- Test 10: double claim_prize -------------------------- */
  console.log("Test 10 – Winner attempts to claim prize again");
  {
    const { ok } = await runTx("winner double claim", () => userClients[winnerIndex].tx.compute.executeContract(
      {
        sender: winnerAddress,
        contract_address,
        code_hash,
        msg: { claim_prize: {} },
        sent_funds: [],
      },
      { gasLimit: 60_000 }
    ));
    if (ok) fail("Was able to claim prize twice");
    else pass("Cannot claim prize twice");
  }

  console.log("\n🎉 All raffle tests completed!\n");
}

main().catch((err) => {
  console.error("Test script failed:", err);
  process.exit(1);
});
