const avalanche = require("avalanche");
const BN = require("bn.js");
const Buffer = require('buffer/').Buffer;



/* ADJUST TEHSE LINES ACCORDINGLY */
/* THIS SCRIPT PRESENTLY ASSUMES NO TX FEES */
const networkId = 3;
const N = 1500; // We're making how many???
const A = 1; // number nanoAVAX funding each N addresses
const genSK = "<some secret key with a TON of AVAX>"; // change that for sure

let ava = new avalanche.Avalanche("localhost", 9650, "http", 3, "X");
let avm = ava.AVM(); //returns a reference to the AVM API used by Avalanche

let bintools = ava.BinTools.getInstance();

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  } 

 async function run() { 
    console.log("entered run");
    // make a keychain
    let myKeychain = avm.keyChain();

    // import a secret key that has a ton of avax for funding other addresses
    let mysk = bintools.avaDeserialize(genSK);
    // let's just call this address the "genesis address" (even though it doesn't have to be in the genesis)
    let genesisAddress = myKeychain.importKey(mysk);
    console.log(bintools.avaSerialize(genesisAddress));

    // ok to be safe, let's put a budget into some intermediary address 
    let fundedAddress = myKeychain.makeKey();
    
    console.log("getasset id")
    // we're going to need the raw assetID for the AVAX asset
    let assetid = await avm.getAVAAssetID();

    console.log("get utxos");
    // get every UTXO for the genesis address and put it into a UTXOSet (this is a class called UTXOSet btw)
    let genutxos = await avm.getUTXOs([genesisAddress]);
    console.log(genutxos.getBalance([genesisAddress], assetid));

    // let's max a transaction, it's just a simple spend tx, and let's fund our "fundedAddress" with the budget
    let btx = await avm.buildBaseTx(genutxos, new BN(N * A), [fundedAddress], [genesisAddress], [genesisAddress], assetid);
    console.log("signing 1");
    // you must sign for it to be fine
    let tx = btx.sign(myKeychain);
    console.log(tx.toBuffer().toString("hex"));
    console.log("issuing 1");

    // issue that signed tx
    let txidissue = await avm.issueTx(tx);

    console.log("issued 1, sleeping");
    // look timeouts are terrible and not necessary but for the sake of example, we're using them
    await sleep(5000);

    // ok this should be accepted definitely after that kinda super long timeout
    let status = await avm.getTxStatus(txidissue);
    console.log("status", status);
    if(status != "Accepted") {
        console.log("tx not accepted");
        // ok if we can't get funds in 5 seconds, things are broken, let's bail and figure that out
        process.exit();
    }
    console.log("tx accepted, funded");

    // we're going to need the raw blockchainID to build tx's
    let blockchainID = avm.getBlockchainID();

    // let's get the funded address's string-address
    let faddr = myKeychain.getKey(fundedAddress).getAddressString();
    console.log(faddr);

    // let's get the funded address's UTXOSet (class instance)
    let utxos = await avm.getUTXOs([faddr]);

    // An array for Outputs we're going to produce
    let outs = [];

    // Make a new key, put it into the keychain, return its address
    let addr = myKeychain.makeKey();
    console.log("sending to", bintools.avaSerialize(addr))

    // How much we spendin' ?
    let total = new BN(0);

    // we're going to make N addresses
    for(let i = 0; i < N; i++) {
        // Create a fresh SecpOutput. It's going to have A nAVA
        let o = new Avalanche.SecpOutput(new BN(A), new BN(0), 1, [addr]);
        // This creates a TransferableOutput class for the assetID 
        let xferout = new Avalanche.TransferableOutput(assetid, o);
        // This pushes the output to the list of outputs we're going to produce
        outs.push(xferout);
        // lmao how much we spendin?
        total = total.add(new BN(A));
    }

    // let's just get all the UTXOs from the UTXOSet for the funded address
    let utxoall = utxos.getAllUTXOs();

    // Ok we already know this is the only UTXO in that set so let's just get it.
    let utxo = utxoall[0];

    // The output from that UTXO is going to be the Input for our transaction 
    let output = utxo.getOutput(); //type assert AmountOutput

    // Get the output Index from the UTXO
    let outputidx = utxo.getOutputIdx();

    // Get the transaction of the UTXO
    let txid = utxo.getTxID();

    // Create a SecpInput class to consume the UTXO
    let input = new Avalanche.SecpInput(output.getAmount());

    // Add the address index from the UTXO's output to say "hey this address on the output is spending"
    // add that index to the input
    input.addSignatureIdx(output.getAddressIdx(fundedAddress), fundedAddress);

    // create a TransferableInput 
    let xferin = new Avalanche.TransferableInput(txid, outputidx, assetid, input);
    
    // create a base transaction by passing in the networkId, the chainID, list of outputs, list of inputs
    let basetx = new Avalanche.BaseTx(networkId, bintools.avaDeserialize(blockchainID), outs, [xferin]);

    // wrap the base transaction in an unsigned transaction, which adds txtypeId in the process
    let finaltx = new Avalanche.UnsignedTx(basetx);

    // sign it and return the Tx
    let thebigone = finaltx.sign(myKeychain);

    //issue the Tx
    let txidfinale = await avm.issueTx(thebigone);

    console.log("txidfinale", txidfinale, "address", bintools.avaSerialize(fundedAddress), "sent everything to", bintools.avaSerialize(addr));

 }
console.log("entering run");
 run().catch((e) => {
    console.log(e)
 });

