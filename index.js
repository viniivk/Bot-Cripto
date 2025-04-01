const axios = require("axios")
const crypto = require("crypto")

const SYMBOL = "BTCUSDT";
const QUANTITY = "0.00005";
const PERIOD = 14;

let lastBuyPrice = 0;
let lastSellPrice = 0;
let totalProfitUSDT = 0;
let trades = [];

const API_URL = "https://testnet.binance.vision"
const API_KEY = "" // Usar sua API key
const SECRET_KEY = "" // Usar sua Secret key

// Função para obter cotação do USDT em BRL
async function getUSDTBRLPrice() {
    try {
        const { data } = await axios.get(`${API_URL}/api/v3/ticker/price?symbol=USDTBRL`);
        return parseFloat(data.price);
    } catch (err) {
        log("Erro ao obter cotação USDT/BRL:", err.message);
        return null;
    }
}

// Função para converter USDT para BRL
async function convertUSDTtoBRL(usdtAmount) {
    const usdtBrlPrice = await getUSDTBRLPrice();
    if (usdtBrlPrice) {
        return usdtAmount * usdtBrlPrice;
    }
    return null;
}

function averages(prices, period, startIndex){      
    let gains = 0, losses = 0;

    for(let i=0; i < period && (i + startIndex) < prices.length; i++){
        const diff = prices[i + startIndex] - prices[i + startIndex - 1]
        if(diff >= 0)
            gains += diff
        else
            losses += Math.abs(diff)
    }

    let avgGains = gains / period;
    let avgLosses = losses / period;
    return { avgGains, avgLosses };
}

function RSI(prices, period){
    let avgGains = 0, avgLosses = 0;

    for(let i=1; i < prices.length; i++){
        let newAverages = averages(prices, period, i)

        if(i === 1){
            avgGains = newAverages.avgGains
            avgLosses = newAverages.avgLosses
            continue
        }

        avgGains = (avgGains * (period - 1) + newAverages.avgGains) / period
        avgLosses = (avgLosses * (period - 1) + newAverages.avgLosses) / period
    }

    const rs = avgGains / avgLosses
    return 100 - (100 / (1 +rs))
}

function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
}

function showTradingSummary() {
    log("\n=== RESUMO DAS OPERAÇÕES ===");
    log(`Total de trades: ${trades.length}`);
    log(`Lucro total (USDT): ${totalProfitUSDT.toFixed(2)} USDT`);
    
    const winningTrades = trades.filter(trade => trade.profit > 0);
    const losingTrades = trades.filter(trade => trade.profit < 0);
    
    log(`Trades positivos: ${winningTrades.length}`);
    log(`Trades negativos: ${losingTrades.length}`);
    
    if (trades.length > 0) {
        const winRate = (winningTrades.length / trades.length) * 100;
        log(`Taxa de acerto: ${winRate.toFixed(2)}%`);
    }
    log("==========================\n");
}

async function newOrder(symbol, quantity, side) {
    const order = { symbol, quantity, side };
    order.type = "MARKET";
    order.timestamp = Date.now();

    const signature = crypto
        .createHmac("sha256", SECRET_KEY)
        .update(new URLSearchParams(order).toString())
        .digest("hex");

    order.signature = signature;

    try {
        const { data } = await axios.post(
            API_URL + "/api/v3/order",
            new URLSearchParams(order).toString(),
            {
                headers: { "X-MBX-APIKEY": API_KEY }
            }
        );

        log("Ordem executada:", data);

        const orderPrice = parseFloat(data.cummulativeQuoteQty) / parseFloat(data.executedQty);
        const orderValueUSDT = orderPrice * parseFloat(quantity);
        const orderValueBRL = await convertUSDTtoBRL(orderValueUSDT);

        if (side === "BUY") {
            lastBuyPrice = orderPrice;
            log(`✅ BTC comprado a ${lastBuyPrice.toFixed(2)} USDT`);
            log(`💵 Valor em USDT: ${orderValueUSDT.toFixed(2)} USDT`);
            log(`💰 Valor em BRL: R$ ${orderValueBRL.toFixed(2)}`);
        } else if (side === "SELL") {
            lastSellPrice = orderPrice;
            log(`✅ BTC vendido a ${lastSellPrice.toFixed(2)} USDT`);
            log(`💵 Valor em USDT: ${orderValueUSDT.toFixed(2)} USDT`);
            log(`💰 Valor em BRL: R$ ${orderValueBRL.toFixed(2)}`);

            if (lastBuyPrice > 0) {
                const profitUSDT = (lastSellPrice - lastBuyPrice) * parseFloat(quantity);
                totalProfitUSDT += profitUSDT;
                const profitBRL = await convertUSDTtoBRL(profitUSDT);

                trades.push({
                    buyPrice: lastBuyPrice,
                    sellPrice: lastSellPrice,
                    profit: profitUSDT,
                    timestamp: new Date().toISOString()
                });

                log(`📈 Lucro desta operação: ${profitUSDT.toFixed(2)} USDT (R$ ${profitBRL.toFixed(2)})`);
                log(`📊 Lucro total acumulado: ${totalProfitUSDT.toFixed(2)} USDT`);
                
                showTradingSummary();
            }
        }

    } catch (err) {
        log("Erro na ordem:", err.response ? err.response.data : err.message);
    }
}

async function getBalance() {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
        .createHmac("sha256", SECRET_KEY)
        .update(queryString)
        .digest("hex");

    try {
        const { data } = await axios.get(`${API_URL}/api/v3/account`, {
            headers: { "X-MBX-APIKEY": API_KEY },
            params: { timestamp, signature }
        });

        const btcBalance = data.balances.find(b => b.asset === "BTC");
        const usdtBalance = data.balances.find(b => b.asset === "USDT");

        return {
            btc: btcBalance ? btcBalance.free : "0.00000000",
            usdt: usdtBalance ? usdtBalance.free : "0.00000000"
        };
    } catch (err) {
        log("Erro ao buscar saldo:", err.response ? err.response.data : err.message);
        return { btc: "0.00000000", usdt: "0.00000000" };
    }
}

let isOpened = false;
let firstRun = true;

async function start() {
    const balance = await getBalance();
    const { data } = await axios.get(API_URL + "/api/v3/klines?limit=100&interval=15m&symbol=" + SYMBOL);
    const candle = data[data.length - 1];
    const lastPrice = parseFloat(candle[4]);
    const prices = data.map(k => parseFloat(k[4]));
    const rsi = RSI(prices, PERIOD);

    if (firstRun) {
        console.clear();
        log("=== BOT DE TRADING INICIADO ===");
        firstRun = false;
    }

    log("\n=== ATUALIZAÇÃO DE STATUS ===");
    log(`Preço atual: ${lastPrice.toFixed(2)} USDT`);
    log(`RSI: ${rsi.toFixed(2)}`);
    log(`Posição aberta? ${isOpened ? "SIM" : "NÃO"}`);
    log(`Saldo BTC: ${balance.btc}`);
    log(`Saldo USDT: ${balance.usdt}`);
    log("===========================");

    if(rsi < 40 && isOpened === false){ // [30/70 - equilibrado] [25/75 - conservador] [40/60 - agressivo]
        log("📈 RSI SOBREVENDIDO - COMPRANDO");
        isOpened = true;
        await newOrder(SYMBOL, QUANTITY, "BUY");
    }
    else if(rsi > 60 && isOpened === true){
        log("📉 RSI SOBRECOMPRADO - VENDENDO");
        await newOrder(SYMBOL, QUANTITY, "SELL");
        isOpened = false;
    }    
    else {
        log("⏳ AGUARDANDO SINAL...");
    }
}

setInterval(start, 3000);

start(); // código operando com +ou- 5USDT (limite mínimo da Binance)