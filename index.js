const slopes = require("slopes");
const BN = require("bn.js");
const Buffer = require('buffer/').Buffer;

let bintools = slopes.BinTools.getInstance();

let ava = new slopes.Slopes("localhost", 9650, "http", 3, "X");
let avm = ava.AVM(); //returns a reference to the AVM API used by Slopes

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  } 

 async function run() { 
     console.log("entered run");
    let myKeychain = avm.keyChain();
    let mypk = bintools.avaDeserialize("2VmHrE91a2jAupjYAek7qosdMTq24SNBrhxjekBvjRm2swbQQ8");
    let genesisAddress = myKeychain.importKey(mypk);
    console.log(bintools.avaSerialize(genesisAddress));
    let fundedAddress = myKeychain.makeKey();
    console.log("getasset id")
    let assetid = await avm.getAVAAssetID();
    console.log("get utxos");
    let genutxos = await avm.getUTXOs([genesisAddress]);
    console.log(genutxos.getBalance([genesisAddress], assetid));
    let btx = await avm.makeBaseTx(genutxos, new BN,(1500000), [fundedAddress], [genesisAddress], [genesisAddress], assetid);
    console.log("signing 1");
    let tx = btx.sign(myKeychain);
    console.log("issuing 1");
    let txidissue = await avm.issueTx(tx);
    console.log("issued 1, sleeping");
    await sleep(5000);

    let status = await avm.getTxStatus(txidissue);
    console.log("status", status);
    if(status != "Accepted") {
        console.log("tx not accepted");
        process.exit();
    }
    console.log("tx accepted, fundd");

    let blockchainID = avm.getBlockchainID();

    let utxos = await avm.getUTXOs([fundedAddress]);

    let outs = [];

    let addr = myKeychain.makeKey();

    let total = new BN(0);

    for(let i = 0; i < 10; i++) {
        let o = new slopes.SecpOutput(new BN(1000), new BN(0), 1, [addr]);
        let xferout = new slopes.TransferableOutput(assetid, o);
        outs.push(xferout);
        total = total.add(1000);
        console.log("making output ", i);
    }

    let utxo = utxos.getAllUTXOs()[0];
    let output = utxo.getOutput(); //type assert AmountOutput
    let outputidx = utxos.getOutputIdx();
    let txid = utxo.getTxID();
    let input = new slopes.SecpInput(output.getAmount());
    let xferin = new slopes.TransferableInput(txid, outputidx, assetID, input);


    let basetx = new slopes.BaseTx(3, blockchainID, outs, [xferin]);
    let finaltx = new slopes.UnsignedTx(basetx);
    console.log("signing");
    finaltx.sign(myKeychain);
    console.log("issuing");
    let txidfinale = await avm.issueTx(finaltx);

    console.log("txidfinale", txidfinale);

 }
console.log("entering run");
 run().catch((e) => {
    console.log(e)
 });

