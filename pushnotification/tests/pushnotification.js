const anchor = require("@project-serum/anchor");
const assert = require("assert");
const BN = anchor.BN;
const Transaction = require("@project-serum/anchor").web3.Transaction;
const SystemProgram = require("@project-serum/anchor").web3.SystemProgram;
const PublicKey = require("@project-serum/anchor").web3.PublicKey;

describe("Push Notification Fee Collector", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());
  const program = anchor.workspace.Pushnotification;
  const updater = anchor.web3.Keypair.generate();
  const updater2 = anchor.web3.Keypair.generate();
  const vaultPublickey = new anchor.web3.PublicKey('5rerByck3J1FVBkj88BqkGdyvWcUfVRB8c3G3yuGWRAd');
  let receiver = anchor.web3.Keypair.generate();

  it("initialized the smart contract", async () => {

    const [mainData, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from("mainDataForTheProgram")],
      program.programId,
    );

    await program.rpc.init(new BN(443000), nonce, {
      accounts: {
        mainData,
        vault: vaultPublickey,
        payer: program.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
    });

    const mainDataAccount = await program.account.mainData.fetch(mainData);
    assert.ok(mainDataAccount.vault.equals(vaultPublickey));
  });

  
  it("Prepay a notification", async () => {

    const [mainData, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from("mainDataForTheProgram")],
      program.programId,
    );

    payer= program.provider.wallet;

    
    let vaultBalance = await program.provider.connection.getBalance(vaultPublickey);
    assert.ok(vaultBalance === 0 );

    await program.rpc.prepaidNotification("123", {
      accounts: {
        mainData,
        vault: vaultPublickey,
        updater: updater.publicKey,
        payer: program.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [],
    });
    
    
    const mainDataAccount = await program.account.mainData.fetch(mainData);
    assert.ok(mainDataAccount.notifications[0].notificationId == "123" );
    assert.ok(mainDataAccount.notifications[0].updater.equals(updater.publicKey) );
    assert.ok(mainDataAccount.notifications[0].sent == false );

    vaultBalance = await program.provider.connection.getBalance(vaultPublickey);
    console.log("Vault Balance -->" + vaultBalance );
    assert.ok(vaultBalance === 440561 );
  });

  

  it("Prepay the same notification id should return an error", async () => {

    const [mainData, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from("mainDataForTheProgram")],
      program.programId,
    );
    
    payer= program.provider.wallet;

    try {
      const tx = await program.rpc.prepaidNotification("123", {
        accounts: {
          mainData,
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
    
    const [mainData, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from("mainDataForTheProgram")],
      program.programId,
    );

    let [event, slot] = await new Promise((resolve, _reject) => {
      listener = program.addEventListener("NotificationSent", (event, slot) => {
        resolve([event, slot]);
      });
      program.rpc.updateAndSend("123", "1", "EncryptedNotification", {
        accounts: {
          mainData,
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

    const mainDataAccount = await program.account.mainData.fetch(mainData);
    assert.ok(mainDataAccount.notifications[0].sent == true );
    
  });

  

  it("Update and Send Notification", async () => {
    payer= program.provider.wallet;
    const payer2 = anchor.web3.Keypair.generate();

    const [mainData, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from("mainDataForTheProgram")],
      program.programId,
    );

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
          mainData,
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
          mainData,
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
    
    const [mainData, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from("mainDataForTheProgram")],
      program.programId,
    );

    try {
      const tx = await program.rpc.updateAndSend("123", "1", "EncryptedNotification", {
        accounts: {
          mainData,
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