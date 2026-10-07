/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const flush = () => new Promise(resolve => setImmediate(resolve));
const source = fs.readFileSync(path.join(__dirname, "..", "App.tsx"), "utf8");
function run(text, globals) {
  const js = ts.transpileModule(text, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
  const context = vm.createContext(globals); vm.runInContext(js, context); return context;
}
async function main() {
  let tick, foreground, loads = 0, cleanup;
  const appState = {currentState: "active", addEventListener: (_, cb) => {foreground=cb; return {remove: () => {foreground=null;}};}};
  const start = source.lastIndexOf("  useEffect(() => {",source.indexOf("    const refreshPage = async () => {"));
  const end = source.indexOf("\n  async function refreshAppData",start);
  run(source.slice(start,end), {stage:"app", token:"buyer", activeTab:"support", selectedTicket:null, editingProfile:false,showPaymentHistory:false, AppState:appState,
    useEffect: callback => {cleanup=callback();}, setInterval: cb => {tick=cb; return 1;}, clearInterval: () => {tick=null;},
    loadSupportTickets: async () => {loads++;}, loadTicketMessages: async () => {},
    supportTicketRequest:{current:0}, supportMessageRequest:{current:0}});
  await flush(); assert.equal(loads,1,"opening Support must fetch history without pull-to-refresh");
  tick(); await flush(); assert.equal(loads,2);
  appState.currentState="background"; tick(); await flush(); assert.equal(loads,2,"background pages must not poll");
  appState.currentState="active"; foreground("active"); await flush(); assert.equal(loads,3,"foreground must revalidate");
  cleanup(); assert.equal(tick,null); assert.equal(foreground,null);

  const pending=[]; let tickets=[], error="", loading=false;
  const state = {token:"buyer", sessionTokenRef:{current:"buyer"}, supportTicketRequest:{current:0}, supportTickets:[], supportTicketsRef:{current:[]}, setTicketListCursor:()=>{},
    fetchWithTimeout: () => new Promise(resolve => pending.push(resolve)),
    setSupportTickets: value => {tickets=typeof value === "function" ? value(tickets) : value;},setSelectedTicket: update => update(null),
    setSupportLoading: value => {loading=value;}, setSupportError:value=>{error=value;}, API_URL:"https://example.test"};
  const loaderStart=source.indexOf("  async function loadSupportTickets(");
  const loaderEnd=source.indexOf("\n  async function createSupportTicket",loaderStart);
  const loader=run(source.slice(loaderStart,loaderEnd),state);
  const old=loader.loadSupportTickets();const recent=loader.loadSupportTickets();
  pending[1]({ok:true,json:async()=>({tickets:[{id:"latest",created_at:"2026-10-05"}]})});await recent;
  pending[0]({ok:true,json:async()=>({tickets:[]})});await old;
  assert.equal(tickets[0].id,"latest","late empty history must not erase loaded interactions");assert.equal(loading,false);
  const failed=loader.loadSupportTickets();pending[2]({ok:false,json:async()=>({message:"Offline"})});await failed;
  assert.equal(error,"Offline");assert.equal(tickets[0].id,"latest","failure must preserve cached history and show retry");
  const signedOut=loader.loadSupportTickets();state.sessionTokenRef.current="another-buyer";
  pending[3]({ok:true,json:async()=>({tickets:[{id:"old-private-data",created_at:"2026-10-05"}]})});await signedOut;
  assert.equal(tickets[0].id,"latest","previous session response must be ignored");

  // Exercise the actual payment functions: backend recording errors must not
  // become an endless "waiting for Flutterwave" message or clear paid goods.
  let paymentMessage="", cart=[{product:{id:"watch",sku:"WATCH"},quantity:1}], pendingDeleted=0, networkCalls=0;
  const paidQuote={order_id:"order",cart_items:[{product_id:"watch",quantity:1}]};
  let verification={status:409,ok:false,data:{message:"constraint failure"}};
  const paymentState={token:"buyer",sessionTokenRef:{current:"buyer"},paymentPollGeneration:{current:0},paymentConfirmationIssue:{current:""},
    API_URL:"https://example.test",URL,readResponseBody:async response=>response.data,
    fetchWithTimeout:async (_url,options)=>{networkCalls++;assert.equal(options.cache,"no-store");return verification;},
    logout:async()=>{},setPaymentState:()=>{},setPaymentMessage:value=>{paymentMessage=value;},
    quote:paidQuote,quoteRef:{current:paidQuote},completedPayments:{current:new Set()},removePurchasedItems:(items,purchased)=>items.filter(item=>!purchased.some(p=>p.product_id===item.product.id)),
    cartRef:{current:cart},setCart:value=>{cart=typeof value==='function'?value(cart):value;},setQuote:()=>{},PENDING_PAYMENT_KEY:"pending",
    SecureStore:{deleteItemAsync:async()=>{pendingDeleted++;}},loadNotifications:async()=>{},loadXPBalance:async()=>{},loadOrders:async()=>{},
    Alert:{alert:()=>{}},setActiveTab:()=>{},sleep:async()=>{}};
  const paymentStart=source.indexOf("  async function verifyPaymentWithBackend(");
  const paymentEnd=source.indexOf("\n  async function claimDailyXP",paymentStart);
  const payment=run(source.slice(paymentStart,paymentEnd),paymentState);
  assert.equal(await payment.verifyPaymentWithBackend("order"),false);
  assert.match(paymentMessage,/Do not pay again/);
  assert.equal(await payment.pollPaymentStatus("order"),false);
  assert.equal(networkCalls,1,"recording failure must not trigger another misleading polling loop");
  assert.equal(cart.length,1);assert.equal(pendingDeleted,0);
  verification={status:200,ok:true,data:{payment_state:"settled"}};
  assert.equal(await payment.verifyPaymentWithBackend("order"),true);
  await payment.completeSuccessfulPayment();
  assert.equal(cart.length,0);assert.equal(paymentState.cartRef.current.length,0);
  assert.equal(pendingDeleted,1);assert.equal(paymentState.paymentConfirmationIssue.current,"");
  assert.equal(await payment.pollPaymentStatus("order",0,false,0),false,"completed checkout must invalidate older pollers");
  verification={status:202,ok:true,data:{payment_state:"pending"}};
  assert.equal(await payment.verifyPaymentWithBackend("order"),false);
  assert.equal(paymentState.paymentConfirmationIssue.current,"");
  paymentState.fetchWithTimeout=async()=>{paymentState.sessionTokenRef.current="another-buyer";return {status:200,ok:true,data:{payment_state:"settled"}};};
  assert.equal(await payment.verifyPaymentWithBackend("order"),false,"late verification must not confirm another buyer's cart");
  console.log("Page refresh regressions passed: entry, foreground, background pause, late response, retained history and session isolation.");
  console.log("Payment regressions passed: recording error, retry recovery, cart clearing, pending response and stale session.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
