// client.js is used to introduce the reader to generating clients from IDLs.
// It is not expected users directly test with this example. For a more
// ergonomic example, see `tests/basic-0.js` in this workspace.

const anchor = require('@project-serum/anchor');
const BN = anchor.BN;
const PublicKey = require("@project-serum/anchor").web3.PublicKey;


// Configure the local cluster.
anchor.setProvider(anchor.Provider.local("https://api.devnet.solana.com"));

async function main() {
  // #region main
  // Read the generated IDL.
  const idl = JSON.parse(require('fs').readFileSync('./target/idl/pushnotification.json', 'utf8'));

  // Address of the deployed program.
  const programId = new anchor.web3.PublicKey('4tfPZdg22C2fU8kaqYAgh6WUX6iPUx2xBKAAqWE7NAeS');


  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);

  const mainData = anchor.web3.Keypair.generate(); //key for the new account for check data
  const updater = anchor.web3.Keypair.generate();
  const updater2 = anchor.web3.Keypair.generate();
  
  
  const vaultPublickey = new anchor.web3.PublicKey('C9NivVSqjf9xbrErap2DwmPtVPV6mutsfZZ3pHDgwQDN');

  let receiver = anchor.web3.Keypair.generate();

  const accountInit = await PublicKey.createProgramAddress(
    [Buffer.from("mainDataForTheProgram")],
    programId,
  );

  console.log("account Init" +  accountInit);

  await program.rpc.init(new BN(443000), {
    accounts: {
      accountInit: accountInit,
      mainData: mainData.publicKey,
      vault: vaultPublickey,
      payer: program.provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    },
    signers: [mainData],
    instructions: [
      await program.account.mainData.createInstruction(mainData, 200), // create an check account
    ],
  });

  /*
  await program.rpc.prepaidNotification("123", {
    accounts: {
      mainData: mainData.publicKey,
      vault: vaultPublickey,
      updater: updater.publicKey,
      payer: program.provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    },
    signers: [],
  });

  const tx =await program.rpc.updateAndSend("123", "1", "EncryptedNotification", {
    accounts: {
      mainData: mainData.publicKey,
      updater: updater.publicKey,
      payer: program.provider.wallet.publicKey,
    },
    signers: [updater],
  });
  */

}

console.log('Running client.');
main().then(() => console.log('Success'));
