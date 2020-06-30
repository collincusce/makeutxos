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
    let mypk = bintools.avaDeserialize("28Qmpffe2aEaEXuC7nEGfnbfhuFZJPTawwaGMyzB7jcmzDxS4p");
    let genesisAddress = myKeychain.importKey(mypk);
    console.log(bintools.avaSerialize(genesisAddress));
    let fundedAddress = myKeychain.makeKey();
    console.log("getasset id")
    let assetid = await avm.getAVAAssetID();
    console.log("get utxos");
    let genutxos = await avm.getUTXOs([genesisAddress]);
    console.log(genutxos.getBalance([genesisAddress], assetid));
    let btx = await avm.makeBaseTx(genutxos, new BN(1500000), [fundedAddress], [genesisAddress], [genesisAddress], assetid);
    console.log("signing 1");
    let tx = btx.sign(myKeychain);
    console.log(tx.toBuffer().toString("hex"));
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
    console.log("tx accepted, funded");

    let blockchainID = avm.getBlockchainID();
    let faddr = myKeychain.getKey(fundedAddress).getAddressString();
    console.log(faddr);

    let utxos = await avm.getUTXOs([faddr]);

    let outs = [];

    let addr = myKeychain.makeKey();
    console.log("sending to", bintools.avaSerialize(addr))

    let total = new BN(0);

    for(let i = 0; i < 2500; i++) {
        let o = new slopes.SecpOutput(new BN(100), new BN(0), 1, [addr]);
        let xferout = new slopes.TransferableOutput(assetid, o);
        outs.push(xferout);
        total = total.add(new BN(100));
    }

    let utxoall = utxos.getAllUTXOs();
    let utxo = utxoall[0];
    let output = utxo.getOutput(); //type assert AmountOutput
    let outputidx = utxo.getOutputIdx();
    let txid = utxo.getTxID();
    let input = new slopes.SecpInput(output.getAmount());
    input.addSignatureIdx(output.getAddressIdx(fundedAddress), fundedAddress);
    let xferin = new slopes.TransferableInput(txid, outputidx, assetid, input);
    
    let basetx = new slopes.BaseTx(3, bintools.avaDeserialize(blockchainID), outs, [xferin]);
    let finaltx = new slopes.UnsignedTx(basetx);
    let thebigone = finaltx.sign(myKeychain);
    let txidfinale = await avm.issueTx(thebigone);

    console.log("txidfinale", txidfinale, "address", bintools.avaSerialize(fundedAddress), "sent everything to", bintools.avaSerialize(addr));

 }
console.log("entering run");
 run().catch((e) => {
    console.log(e)
 });

