const anchor = require("@project-serum/anchor");
const assert = require("assert");
const BN = anchor.BN;
const Transaction = require("@project-serum/anchor").web3.Transaction;
const SystemProgram = require("@project-serum/anchor").web3.SystemProgram;

describe("Push Notification Fee Collector", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.Pushnotification;

  const mainData = anchor.web3.Keypair.generate(); //key for the new account for check data
  const updater = anchor.web3.Keypair.generate();
  const updater2 = anchor.web3.Keypair.generate();
  
  
  const vaultPublickey = new anchor.web3.PublicKey('5rerByck3J1FVBkj88BqkGdyvWcUfVRB8c3G3yuGWRAd');

  let receiver = anchor.web3.Keypair.generate();

  it("initialized the smart contract", async () => {
    
    await program.rpc.init(new BN(443000), {
      accounts: {
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

    const mainDataAccount = await program.account.mainData.fetch(mainData.publicKey);
    assert.ok(mainDataAccount.vault.equals(vaultPublickey));
  });


  it("Prepay a notification", async () => {

    payer= program.provider.wallet;

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
    
    
    const mainDataAccount = await program.account.mainData.fetch(mainData.publicKey);
    assert.ok(mainDataAccount.notifications[0].notificationId == "123" );
    assert.ok(mainDataAccount.notifications[0].updater.equals(updater.publicKey) );
    assert.ok(mainDataAccount.notifications[0].sent == false );

    const vaultBalance = await program.provider.connection.getBalance(vaultPublickey);
    assert.ok(vaultBalance === 440561 );
  });

  it("Prepay the same notification should return an error", async () => {

    payer= program.provider.wallet;

    try {
      const tx = await program.rpc.prepaidNotification("123", {
        accounts: {
          mainData: mainData.publicKey,
          vault: vaultPublickey,
          updater: updater2.publicKey,
          payer: program.provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [],
      });
      assert.ok(false);
    } catch (err) {
      const errMsg =
        "Notification already Exist";
      assert.equal(err.toString(), errMsg);
      assert.equal(err.msg, errMsg);
      assert.equal(err.code, 303);
    }

  }); 
 
  it("Update and Send Notification", async () => {
    
    let [event, slot] = await new Promise((resolve, _reject) => {
      listener = program.addEventListener("NotificationSent", (event, slot) => {
        resolve([event, slot]);
      });
      program.rpc.updateAndSend("123", "1", "EncryptedNotification", {
        accounts: {
          mainData: mainData.publicKey,
          updater: updater.publicKey,
          payer: program.provider.wallet.publicKey,
        },
        signers: [updater],
      });
    });

    await program.removeEventListener(listener);
    assert.ok(slot > 0);
    assert.ok(event.notificationId == "123");
    assert.ok(event.messageType == "1");
    assert.ok(event.encryptedPayload == "EncryptedNotification");

    const mainDataAccount = await program.account.mainData.fetch(mainData.publicKey);
    assert.ok(mainDataAccount.notifications[0].sent == true );
    
  });

  it("Update and Send Notification", async () => {
    payer= program.provider.wallet;
    const payer2 = anchor.web3.Keypair.generate();

    await program.provider.send(
      (() => {
        const tx = new Transaction();
        tx.add(
          SystemProgram.transfer({
            fromPubkey: program.provider.wallet.publicKey,
            toPubkey: payer2.publicKey,
            lamports: 1000000,
          })
        );
        return tx;
      })()
    );

    try {
      const tx =await program.rpc.updateAndSend("123", "1", "EncryptedNotification", {
        accounts: {
          mainData: mainData.publicKey,
          updater: updater.publicKey,
          payer: program.provider.wallet.publicKey,
        },
        signers: [updater],
      });
    } catch (err) {
      const errMsg =
        "The given notification has already been sent.";
      assert.equal(err.toString(), errMsg);
      assert.equal(err.msg, errMsg);
      assert.equal(err.code, 300  );
    }

    await program.provider.send(
      (() => {
        const tx = new Transaction();
        tx.add(
          SystemProgram.transfer({
            fromPubkey: program.provider.wallet.publicKey,
            toPubkey: payer2.publicKey,
            lamports: 1000000,
          })
        );
        return tx;
      })()
    );

    try {
      const tx =await program.rpc.updateAndSend("123000", "1", "EncryptedNotification", {
        accounts: {
          mainData: mainData.publicKey,
          updater: updater.publicKey,
          payer: program.provider.wallet.publicKey,
        },
        signers: [updater],
      });
    } catch (err) {
      const errMsg =
        "Notification doesn't Exist";
      assert.equal(err.toString(), errMsg);
      assert.equal(err.msg, errMsg);
      assert.equal(err.code, 304  );
    }
  });

  it("should return an error if updater is wrong when Update and Send Notification", async () => {
    try {
      const tx = await program.rpc.updateAndSend("123", "1", "EncryptedNotification", {
        accounts: {
          mainData: mainData.publicKey,
          updater: updater2.publicKey,
          payer: program.provider.wallet.publicKey,
        },
        signers: [updater2],
      });
      assert.ok(false);
    } catch (err) {
      const errMsg =
        "The updater address is incorrect";
      assert.equal(err.toString(), errMsg);
      assert.equal(err.msg, errMsg);
      assert.equal(err.code, 302);
    }
  });

});