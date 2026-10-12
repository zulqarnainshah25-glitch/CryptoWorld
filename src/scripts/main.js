/* =========================================================
   CRYPTOWORLD - FRONTEND MAIN.JS
   Backend: Google Apps Script (scriptURL)
========================================================= */

/* =========================================================
   CONFIG
========================================================= */
const scriptURL =
"https://script.google.com/macros/s/AKfycbzxKNv2JGtgAbLohzkvTwN5it7Xl3iKSKb6RK228k7JQxUnl-OPPKaXrjq5v-eaj9XrPQ/exec";

const OUTCOME_KEY = "";


/* =========================================================
   DEVICE FINGERPRINT
========================================================= */
function getDeviceId() {
    let deviceId = localStorage.getItem("cw_device_id");
    if (deviceId) return deviceId;

    const parts = [
        navigator.userAgent || "",
        screen.width + "x" + screen.height,
        screen.colorDepth || "",
        navigator.language || "",
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || "",
        navigator.platform || ""
    ];

    const raw = parts.join("|");

    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash | 0;
    }

    deviceId = "dev_" + Math.abs(hash).toString(36) + "_" + raw.length;
    localStorage.setItem("cw_device_id", deviceId);
    return deviceId;
}


/* =========================================================
   GLOBAL USER
========================================================= */
let activeUser = localStorage.getItem("cw_username") || "";


/* =========================================================
   HELPERS
========================================================= */
function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Number(n.toPrecision(8)) : 0;
}

function getPricePrecision(price) {
    const a = Math.abs(Number(price));
    if (!Number.isFinite(a) || a === 0) return 2;
    if (a >= 1000) return 2;
    if (a >= 1) return 4;
    if (a >= 0.01) return 5;
    return Math.min(12, Math.max(6, 3 - Math.floor(Math.log10(a))));
}

function formatPrice(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return n.toFixed(getPricePrecision(n));
}

function formatMacd(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return (n === 0 || Math.abs(n) >= 0.01) ? n.toFixed(4) : n.toPrecision(3);
}

function formatDate(dateObj) {
    return dateObj.toLocaleString("en-US", {
        hour: "numeric", minute: "numeric", hour12: true,
        day: "numeric", month: "short"
    });
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function getDirection(data) {
    const raw = data.direction ?? data.signalDirection ?? data.signal_direction ?? data.signal ?? "";
    return String(raw).trim().toUpperCase();
}

function getEntry(data, currentPrice) {
    return safeNumber(data.entry ?? data.suggestedEntry ?? data.entryPrice, currentPrice);
}

function getStopLoss(data) {
    return safeNumber(data.stopLoss ?? data.stop_loss ?? data.sl, 0);
}

function getTakeProfit(data) {
    return safeNumber(data.takeProfit ?? data.take_profit ?? data.tp, 0);
}

function getConfidence(data) {
    const value = data.confidence ?? data.confidenceScore;
    if (value === undefined || value === null) return "N/A";
    const n = Number(String(value).replace("%", "").trim());
    return Number.isFinite(n) ? n + "%" : String(value);
}

function getReasoning(data) {
    return data.reasoning ?? data.reason ?? data.analysis ?? data.explanation ?? "Technical analysis completed.";
}


/* =========================================================
   REFERRAL FUNCTIONS
========================================================= */
function displayReferralInfo(res) {
    if (!res) return;

    const codeEl = document.getElementById("myReferralCode");
    if (codeEl && res.referralCode) codeEl.innerText = res.referralCode;

    const countEl = document.getElementById("refCountDisplay");
    if (countEl) countEl.innerText = res.referralCount || 0;

    const bonusEl = document.getElementById("refBonusDisplay");
    if (bonusEl) bonusEl.innerText = res.referralBonus || 0;
}

function copyReferralCode() {
    const codeEl = document.getElementById("myReferralCode");
    if (!codeEl) return;

    const code = codeEl.innerText.trim();
    if (!code || code === "--") {
        alert("Referral code abhi load nahi hua. Page refresh karein.");
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () {
            alert("\u2705 Referral code copy ho gaya: " + code);
        }).catch(function () {
            fallbackCopy(code);
        });
    } else {
        fallbackCopy(code);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand("copy");
        alert("\u2705 Referral code copy ho gaya: " + text);
    } catch (e) {
        prompt("Yeh aapka referral code hai — manually copy karein:", text);
    }
    document.body.removeChild(ta);
}


/* =========================================================
   AUTH
========================================================= */
async function performAuth(actionType) {
    const user = document.getElementById("usernameInput").value.trim();
    const pass = document.getElementById("passwordInput").value.trim();
    const errBox = document.getElementById("loginError");
    const loginBtn = document.getElementById("loginBtnTrigger");
    const regBtn = document.getElementById("registerBtnTrigger");

    if (!user || !pass) {
        errBox.innerText = "Username aur Password dono darj karein.";
        errBox.style.display = "block";
        return;
    }

    loginBtn.disabled = true;
    regBtn.disabled = true;
    errBox.style.display = "none";

    try {
        const refCodeEl = document.getElementById("referralCodeInput");
        const refCode = (actionType === "register" && refCodeEl) ? refCodeEl.value.trim().toUpperCase() : "";

        const response = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: actionType,
                username: user,
                userId: user,
                password: pass,
                deviceId: getDeviceId(),
                referralCode: refCode
            })
        });

        if (!response.ok) throw new Error("Server HTTP Error: " + response.status);

        const res = await response.json();

        if (res.error === true) throw new Error(res.message || "Authentication failed.");

        const returnedUsername = res.username || res.userId || user;
        activeUser = String(returnedUsername);
        localStorage.setItem("cw_username", activeUser);

        document.getElementById("loginModal").style.display = "none";
        document.getElementById("userIdDisplay").innerText = activeUser;
        document.getElementById("loadingPopup").style.display = "flex";

        if (res.signalsLeft !== undefined) {
            document.getElementById("quotaDisplay").innerText = res.signalsLeft;
            updateWatchAdButton(res.signalsLeft);
        } else {
            await refreshQuota();
        }

        displayReferralInfo(res);

        setTimeout(function () { location.reload(); }, 500);

    } catch (error) {
        errBox.innerText = "\u274c " + (error.message || "Connection error.");
        errBox.style.display = "block";
    } finally {
        loginBtn.disabled = false;
        regBtn.disabled = false;
    }
}


/* =========================================================
   LOGOUT
========================================================= */
function logoutUser() {
    localStorage.removeItem("cw_username");
    activeUser = "";
    location.reload();
}


/* =========================================================
   SIDEBAR
========================================================= */
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
}


/* =========================================================
   WHATSAPP
========================================================= */
function openWhatsApp() {
    const number = "923493730233";
    const userText = activeUser || "Not Logged In";

    const text = `*AOA* Cryptoworld men Khusamdded, Signal Lene ke liye Apna *Username* Share kren.

My Username: ${userText}

Signal Quota:
5 Signals = Rs. 1000
10 Signals = Rs. 1500
20 Signals = Rs  2500

Payment Method Easypaisa
Zulqarnain Shah 
03493730233

Note: Market Fluctuation ki wajah se prediction ghalat bhi ho sakti hai to baraye mehrbani soch samajh ke trade kren. Shukria!`;

    const encodedText = encodeURIComponent(text);
    window.open("https://wa.me/" + number + "?text=" + encodedText, "_blank");
}


/* =========================================================
   LOAD REFERRAL INFO
========================================================= */
async function loadReferralInfo() {
    if (!activeUser) return;

    try {
        const response = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "get_referral_info",
                username: activeUser,
                userId: activeUser
            })
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.error) return;

        displayReferralInfo({
            referralCode: data.referralCode,
            referralCount: data.referralCount,
            referralBonus: data.referralBonus
        });

        checkPremiumStatus();

    } catch (e) {
        console.log("Referral info load error:", e);
    }
}


/* =========================================================
   PREMIUM MODAL
========================================================= */
function openPremiumModal() {
    const modal = document.getElementById("premiumModal");
    if (modal) {
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }
}

function closePremiumModal() {
    const modal = document.getElementById("premiumModal");
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "";
    }
}

document.addEventListener("click", function (e) {
    const modal = document.getElementById("premiumModal");
    if (modal && e.target === modal) closePremiumModal();
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        const modal = document.getElementById("premiumModal");
        if (modal && modal.style.display === "flex") closePremiumModal();
    }
});


async function redeemPremiumCode() {
    if (!activeUser) {
        alert("Pehle login karein.");
        return;
    }

    const codeEl = document.getElementById("premiumCodeInput");
    const btn = document.getElementById("redeemCodeBtn");
    const code = codeEl ? codeEl.value.trim().toUpperCase() : "";

    if (!code || code.length < 5) {
        alert("\u26a0\ufe0f Valid premium code darj karein.");
        return;
    }

    if (!confirm("Code redeem karein: " + code + "?\n\nYeh code ek hi baar use ho sakta hai.")) return;

    btn.disabled = true;
    btn.innerText = "Redeeming...";

    try {
        const response = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "redeem_premium_code",
                username: activeUser,
                userId: activeUser,
                code: code
            })
        });

        if (!response.ok) throw new Error("Server HTTP Error: " + response.status);

        const data = await response.json();

        if (data.error) {
            alert("\u26a0\ufe0f " + (data.message || "Code redeem nahi hua."));
            return;
        }

        const msg = "\ud83c\udf89 Mubarak ho!\n\n" +
            "Plan: " + data.planType + "\n" +
            "Signals/Day: " + data.signalsPerDay + "\n" +
            "Duration: " + data.durationDays + " days\n" +
            "Expiry: " + new Date(data.expiryDate).toLocaleDateString();

        alert(msg);
        if (codeEl) codeEl.value = "";
        closePremiumModal();

        setTimeout(function () {
            checkPremiumStatus();
            refreshQuotaAfterShare();
        }, 500);

    } catch (e) {
        console.log("Redeem error:", e);
        alert("\u26a0\ufe0f Connection error. Dobara koshish karein.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Redeem Code";
    }
}


/* =========================================================
   CHECK PREMIUM STATUS
========================================================= */
async function checkPremiumStatus() {
    if (!activeUser) return;

    try {
        const response = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "check_premium",
                username: activeUser,
                userId: activeUser
            })
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.error) return;

        const premEl = document.getElementById("premiumStatus");
        if (premEl) {
            if (data.premiumActive) {
                const expiry = data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : "";
                premEl.innerHTML = "\u2b50 <b style='color:#ffcc00;'>" + data.premiumPlan +
                    " Active</b> (expires: " + expiry + ")";
            } else {
                premEl.innerHTML = "Free Plan";
            }
        }
    } catch (e) {
        console.log("Premium check error:", e);
    }
}


/* =========================================================
   SHARE REWARD SYSTEM
========================================================= */
async function shareAndClaim(platform) {
    if (!activeUser) {
        alert("Pehle login karein.");
        return;
    }

    const codeEl = document.getElementById("myReferralCode");
    const refCode = codeEl ? codeEl.innerText.trim() : "";

    if (!refCode || refCode === "--") {
        alert("Referral code load nahi hua. Page refresh karein.");
        return;
    }

    const appURL = "https://cryptoworldtest.blogspot.com/p/test-signal.html";
    const shareText = "\ud83d\ude80 CryptoWorld AI Signal App\n\n" +
        "Pakistan ka pehla AI-powered crypto signal app!\n" +
        "\u2705 Live Charts + AI Analysis\n" +
        "\u2705 Free Daily Signals\n\n" +
        "Mera referral code: " + refCode + "\n" +
        "Register karein aur free signals payen:\n" +
        appURL;

    const shareToken = "sh_" + Date.now() + "_" + Math.random().toString(36).substring(2, 10);

    let shareURL = "";
    const encodedText = encodeURIComponent(shareText);
    const encodedURL = encodeURIComponent(appURL);

    if (platform === "whatsapp") shareURL = "https://wa.me/?text=" + encodedText;
    else if (platform === "twitter") shareURL = "https://twitter.com/intent/tweet?text=" + encodedText;
    else if (platform === "facebook") shareURL = "https://www.facebook.com/sharer/sharer.php?u=" + encodedURL + "&quote=" + encodedText;
    else if (platform === "telegram") shareURL = "https://t.me/share/url?url=" + encodedURL + "&text=" + encodedText;
    else {
        alert("Platform valid nahi.");
        return;
    }

    window.open(shareURL, "_blank", "width=600,height=500");

    setTimeout(async function () {
        try {
            const response = await fetch(scriptURL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "share_claim",
                    username: activeUser,
                    userId: activeUser,
                    platform: platform,
                    shareToken: shareToken,
                    deviceId: getDeviceId()
                })
            });

            if (!response.ok) {
                console.log("Share claim failed: HTTP " + response.status);
                return;
            }

            const data = await response.json();

            if (data.error) {
                alert("\u26a0\ufe0f " + (data.message || "Share claim nahi hua."));
                return;
            }

            alert("\ud83c\udf89 " + (data.message || "Shukriya! +0.5 signal mil gaya."));

            updateShareCount(data.todayCount);
            refreshQuotaAfterShare();

        } catch (e) {
            console.log("Share claim error:", e);
        }
    }, 2000);
}

function updateShareCount(count) {
    const el = document.getElementById("todayShareCount");
    if (el) el.innerText = count || 0;
}

async function loadShareStatus() {
    if (!activeUser) return;
    updateShareCount(0);
}


/* =========================================================
   QUOTA REFRESH
========================================================= */
async function refreshQuota() {
    if (!activeUser) return;
    const existing = document.getElementById("quotaDisplay").innerText;
    if (!existing || existing === "--") {
        document.getElementById("quotaDisplay").innerText = "Ready";
    }
    await refreshQuotaAfterShare();
}

async function refreshQuotaAfterShare() {
    if (!activeUser) return;
    try {
        const response = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "quota",
                username: activeUser,
                userId: activeUser
            })
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.error) return;
        if (data.signalsLeft !== undefined) {
            document.getElementById("quotaDisplay").innerText = data.signalsLeft;
            updateWatchAdButton(data.signalsLeft);
        }
    } catch (e) {
        console.log("Quota refresh error:", e);
    }
}


/* =========================================================
   SUGGESTIONS SYSTEM
========================================================= */
async function submitSuggestion() {
    if (!activeUser) {
        alert("Pehle login karein.");
        return;
    }

    const categoryEl = document.getElementById("suggestionCategory");
    const textEl = document.getElementById("suggestionText");
    const submitBtn = document.getElementById("submitSuggestionBtn");

    const category = categoryEl ? categoryEl.value : "Other";
    const suggestion = textEl ? textEl.value.trim() : "";

    if (!suggestion || suggestion.length < 5) {
        alert("\u26a0\ufe0f Suggestion kam az kam 5 harf ki honi chahiye.");
        return;
    }

    if (suggestion.length > 500) {
        alert("\u26a0\ufe0f Suggestion 500 harf se zyada nahi ho sakti.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = "Submitting...";

    try {
        const response = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "submit_suggestion",
                username: activeUser,
                userId: activeUser,
                category: category,
                suggestion: suggestion
            })
        });

        if (!response.ok) throw new Error("Server HTTP Error: " + response.status);

        const data = await response.json();

        if (data.error) {
            alert("\u26a0\ufe0f " + (data.message || "Suggestion submit nahi hui."));
            return;
        }

        alert("\u2705 " + (data.message || "Shukriya! Aapki suggestion mehfooz ho gayi."));

        if (textEl) textEl.value = "";
        updateSuggestionCharCount();

    } catch (e) {
        console.log("Suggestion submit error:", e);
        alert("\u26a0\ufe0f Connection error. Dobara koshish karein.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit";
    }
}

function updateSuggestionCharCount() {
    const textEl = document.getElementById("suggestionText");
    const countEl = document.getElementById("suggestionCharCount");
    if (textEl && countEl) countEl.innerText = textEl.value.length;
}


/* =========================================================
   ACCURACY STATS
========================================================= */
async function loadAccuracyStats() {
    const loadingEl = document.getElementById("accuracyLoading");
    const contentEl = document.getElementById("accuracyContent");
    const errorEl = document.getElementById("accuracyError");

    loadingEl.style.display = "block";
    contentEl.style.display = "none";
    errorEl.style.display = "none";

    try {
        const response = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "accuracy" })
        });

        if (!response.ok) throw new Error("Server HTTP Error: " + response.status);

        const data = await response.json();

        if (data.error === true) throw new Error(data.message || "Accuracy data fetch nahi ho saki.");

        document.getElementById("accTotalClosed").innerText = data.totalClosed ?? 0;
        document.getElementById("accWinsLosses").innerText = (data.wins ?? 0) + "W / " + (data.losses ?? 0) + "L";
        document.getElementById("accWinRate").innerText = (data.winRate ?? 0) + "%";

        const bucketBody = document.getElementById("accBucketBody");
        bucketBody.innerHTML = "";

        const buckets = data.byConfidenceBucket || {};
        const bucketOrder = ["70+", "60-69", "55-59", "under-55"];
        let anyBucket = false;

        bucketOrder.forEach(function (key) {
            const b = buckets[key];
            if (!b || !b.total) return;
            anyBucket = true;

            const row = document.createElement("tr");
            row.innerHTML =
                "<td class=\"pair-col\">" + key + "%</td>" +
                "<td>" + b.total + "</td>" +
                "<td class=\"time-col\">" + (b.winRate ?? 0) + "%</td>";

            bucketBody.appendChild(row);
        });

        if (!anyBucket) {
            const row = document.createElement("tr");
            row.innerHTML = "<td colspan=\"3\" style=\"text-align:center;color:#888;\">Abhi tak koi resolved signal nahi hai.</td>";
            bucketBody.appendChild(row);
        }

        loadingEl.style.display = "none";
        contentEl.style.display = "block";

    } catch (error) {
        loadingEl.style.display = "none";
        errorEl.innerText = "\u26a0\ufe0f " + (error.message || "Accuracy stats load nahi hue.");
        errorEl.style.display = "block";
    }
}


/* =========================================================
   INDICATORS — SMA
========================================================= */
function calculateSMA(data, period) {
    if (!data || data.length < period) return 0;
    let sum = 0;
    for (let i = data.length - period; i < data.length; i++) sum += data[i];
    return sum / period;
}


/* =========================================================
   INDICATORS — EMA
========================================================= */
function calculateEMA(data, period) {
    if (!data || data.length === 0) return [];
    const k = 2 / (period + 1);
    const emaArray = [data[0]];
    for (let i = 1; i < data.length; i++) {
        emaArray.push(data[i] * k + emaArray[i - 1] * (1 - k));
    }
    return emaArray;
}


/* =========================================================
   INDICATORS — MACD
========================================================= */
function calculateMACD(closes) {
    if (!closes || closes.length < 35) return { macd: 0, signal: 0 };

    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);

    const macdLine = ema12.map((value, index) => value - ema26[index]);
    const signalSource = macdLine.slice(26);
    const signalLine = calculateEMA(signalSource, 9);

    return {
        macd: macdLine[macdLine.length - 1],
        signal: signalLine[signalLine.length - 1]
    };
}


/* =========================================================
   INDICATORS — RSI
========================================================= */
function calculateRSI(closes, period = 14) {
    if (!closes || closes.length < period + 1) return 50;

    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const currentGain = change > 0 ? change : 0;
        const currentLoss = change < 0 ? -change : 0;

        avgGain = ((avgGain * (period - 1)) + currentGain) / period;
        avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
    }

    if (avgLoss === 0) return 100;
    if (avgGain === 0) return 0;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}


/* =========================================================
   INDICATORS — ATR + ADX
========================================================= */
function calculateATRAndADX(highs, lows, closes, period = 14) {
    if (!closes || closes.length < period * 2) return { atr: 0, adx: 25 };

    const tr = [], plusDM = [], minusDM = [];

    for (let i = 1; i < closes.length; i++) {
        const h = highs[i], l = lows[i], pc = closes[i - 1];
        tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));

        const upMove = h - highs[i - 1];
        const downMove = lows[i - 1] - l;

        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    function smooth(arr) {
        if (arr.length < period) return [];
        const result = [arr.slice(0, period).reduce((a, b) => a + b, 0)];
        for (let i = period; i < arr.length; i++) {
            result.push(result[result.length - 1] - (result[result.length - 1] / period) + arr[i]);
        }
        return result;
    }

    const smoothedTR = smooth(tr);
    const smoothedPlus = smooth(plusDM);
    const smoothedMinus = smooth(minusDM);

    if (!smoothedTR.length) return { atr: 0, adx: 25 };

    const dx = [];
    for (let i = 0; i < smoothedTR.length; i++) {
        const diPlus = (smoothedPlus[i] / smoothedTR[i]) * 100 || 0;
        const diMinus = (smoothedMinus[i] / smoothedTR[i]) * 100 || 0;
        const sum = diPlus + diMinus;
        dx.push(sum > 0 ? (Math.abs(diPlus - diMinus) / sum) * 100 : 0);
    }

    const adxSmooth = smooth(dx);
    const adx = adxSmooth.length ? adxSmooth[adxSmooth.length - 1] / period : 25;
    const atr = smoothedTR[smoothedTR.length - 1] / period;

    return { atr: atr, adx: adx };
}


/* =========================================================
   BINANCE DATA
========================================================= */
async function getBinanceData(symbol, tf) {
    const url = "https://fapi.binance.com/fapi/v1/klines" +
        "?symbol=" + encodeURIComponent(symbol) +
        "&interval=" + encodeURIComponent(tf) +
        "&limit=250";

    const response = await fetch(url);
    if (!response.ok) throw new Error("Binance API Error: " + response.status);

    const candles = await response.json();

    if (!Array.isArray(candles) || candles.length < 50) {
        throw new Error("Binance ne sufficient candle data return nahi ki.");
    }

    const lastIsForming = Number(candles[candles.length - 1][6]) > Date.now();
    const livePrice = parseFloat(candles[candles.length - 1][4]);
    const cc = lastIsForming ? candles.slice(0, -1) : candles;

    const highs = cc.map(c => parseFloat(c[2]));
    const lows = cc.map(c => parseFloat(c[3]));
    const closes = cc.map(c => parseFloat(c[4]));
    const volumes = cc.map(c => parseFloat(c[5]));

    const closedVols = volumes;
    const latestVolume = closedVols[closedVols.length - 1];
    const prevVols = closedVols.slice(-21, -1);
    const avgVolume = prevVols.length ? prevVols.reduce((a, b) => a + b, 0) / prevVols.length : 0;
    const volumeRatio = avgVolume > 0 ? latestVolume / avgVolume : 1;

    const ema20Arr = calculateEMA(closes, 20);
    const ema50Arr = calculateEMA(closes, 50);
    const ema200Arr = calculateEMA(closes, 200);

    const recent50 = cc.slice(-50);
    const currentPrice = livePrice;

    let swingHighs = [], swingLows = [];
    const K = 2;

    for (let i = K; i <= recent50.length - 2 - K; i++) {
        const c = recent50[i];
        const h = parseFloat(c[2]);
        const l = parseFloat(c[3]);

        let isHigh = true, isLow = true;
        for (let j = 1; j <= K; j++) {
            if (h <= parseFloat(recent50[i - j][2]) || h <= parseFloat(recent50[i + j][2])) isHigh = false;
            if (l >= parseFloat(recent50[i - j][3]) || l >= parseFloat(recent50[i + j][3])) isLow = false;
        }
        if (isHigh) swingHighs.push(h);
        if (isLow) swingLows.push(l);
    }

    const resistancesAbove = swingHighs.filter(h => h > currentPrice).sort((a, b) => a - b);
    const supportsBelow = swingLows.filter(l => l < currentPrice).sort((a, b) => b - a);

    const resistance = resistancesAbove.length > 0 ? resistancesAbove[0] : 0;
    const support = supportsBelow.length > 0 ? supportsBelow[0] : 0;

    const volData = calculateATRAndADX(highs, lows, closes, 14);
    const rsi = calculateRSI(closes, 14);
    const macdData = calculateMACD(closes);

    return {
        closes: closes,
        livePrice: livePrice,
        recentCandles: cc.slice(-50).map(c => ({
            time: Number(c[0]),
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5])
        })),
        rsi: rsi,
        macd: macdData.macd,
        macdSignal: macdData.signal,
        macdHistogram: macdData.macd - macdData.signal,
        sma20: calculateSMA(closes, 20),
        sma50: calculateSMA(closes, 50),
        ema20: ema20Arr.length ? ema20Arr[ema20Arr.length - 1] : 0,
        ema50: ema50Arr.length ? ema50Arr[ema50Arr.length - 1] : 0,
        ema200: ema200Arr.length ? ema200Arr[ema200Arr.length - 1] : 0,
        volumeRatio: volumeRatio,
        adx: volData.adx,
        atr: volData.atr,
        support: toNum(support),
        resistance: toNum(resistance)
    };
}


/* =========================================================
   MAIN SIGNAL FUNCTION
========================================================= */
async function fetchAdvancedSignal() {
    if (!activeUser) {
        document.getElementById("loginModal").style.display = "flex";
        return;
    }

    let symbol = document.getElementById("coinSelect").value;
    symbol = symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    const tf = document.getElementById("timeframeSelect").value;
    const loading = document.getElementById("loading");
    const resultBox = document.getElementById("signalResult");
    const errorBox = document.getElementById("errorBox");
    const button = document.getElementById("generateBtn");
    const warningBox = document.getElementById("warningBox");

    loading.style.display = "block";
    resultBox.style.display = "none";
    errorBox.style.display = "none";
    warningBox.style.display = "none";
    hideWaitFor();
    button.disabled = true;

    const loadingText = document.getElementById("loadingText");
    const msgs = [
        "Live Market Data fetch ho raha hai...",
        "Multi-timeframe structure analyze ho raha hai...",
        "RSI, MACD aur Volume momentum scan ho rahe hain...",
        "Quant Engine processing jaari hai...",
        "AI signal validation ho rahi hai..."
    ];

    let msgIndex = 0;
    loadingText.innerText = msgs[0];

    const loadInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % msgs.length;
        loadingText.innerText = msgs[msgIndex];
    }, 1500);

    try {
        const tf2 = tf === "15m" ? "1h" : (tf === "1h" ? "4h" : "1d");
        const tf3 = tf === "15m" ? "4h" : (tf === "1h" ? "1d" : "1w");

        const results = await Promise.all([
            getBinanceData(symbol, tf),
            getBinanceData(symbol, tf2),
            getBinanceData(symbol, tf3),
            fetch("https://fapi.binance.com/fapi/v1/trades?symbol=" + encodeURIComponent(symbol) + "&limit=1")
        ]);

        const data1 = results[0];
        const data2 = results[1];
        const data3 = results[2];
        const livePriceRes = results[3];

        let currentPrice = 0;
        let marketTimestamp = Date.now();

        if (livePriceRes.ok) {
            try {
                const latestTrade = await livePriceRes.json();
                if (Array.isArray(latestTrade) && latestTrade.length > 0) {
                    currentPrice = safeNumber(latestTrade[0].price || latestTrade[0].p);
                    marketTimestamp = Number(latestTrade[0].time || latestTrade[0].T || Date.now());
                }
            } catch (e) { }
        }

        if (currentPrice <= 0) {
            currentPrice = safeNumber(data1.livePrice || data1.closes[data1.closes.length - 1]);
        }

        if (currentPrice <= 0) throw new Error("Invalid current price received from Binance.");

        const macdData = calculateMACD(data1.closes);
        const rsi = calculateRSI(data1.closes, 14);

        const recentCandles = data1.recentCandles;

        const payload = {
            action: "signal",
            userId: activeUser,
            username: activeUser,
            symbol: symbol,
            timeframe: tf,
            currentPrice: currentPrice,
            marketTimestamp: marketTimestamp,
            recentCandles: recentCandles,
            deviceId: getDeviceId(),
            tf1: {
                rsi: toNum(rsi),
                macd: toNum(macdData.macd),
                macdSignal: toNum(macdData.signal),
                macdHistogram: toNum(macdData.macd - macdData.signal),
                sma20: toNum(data1.sma20),
                sma50: toNum(data1.sma50),
                ema20: toNum(data1.ema20),
                ema50: toNum(data1.ema50),
                ema200: toNum(data1.ema200),
                volumeRatio: toNum(data1.volumeRatio),
                adx: toNum(data1.adx),
                atr: toNum(data1.atr),
                support: toNum(data1.support),
                resistance: toNum(data1.resistance)
            },
            tf2: {
                rsi: toNum(data2.rsi),
                macd: toNum(data2.macd),
                macdSignal: toNum(data2.macdSignal),
                macdHistogram: toNum(data2.macdHistogram),
                sma20: toNum(data2.sma20),
                sma50: toNum(data2.sma50),
                ema20: toNum(data2.ema20),
                ema50: toNum(data2.ema50),
                ema200: toNum(data2.ema200)
            },
            tf3: {
                rsi: toNum(data3.rsi),
                macd: toNum(data3.macd),
                macdSignal: toNum(data3.macdSignal),
                macdHistogram: toNum(data3.macdHistogram),
                sma20: toNum(data3.sma20),
                sma50: toNum(data3.sma50),
                ema20: toNum(data3.ema20),
                ema50: toNum(data3.ema50),
                ema200: toNum(data3.ema200)
            }
        };

        const aiResponse = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        if (!aiResponse.ok) throw new Error("Backend HTTP Error: " + aiResponse.status);

        const responseText = await aiResponse.text();
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error("Backend ne valid JSON return nahi kiya.\n\n" + responseText.substring(0, 1000));
        }

        if (data.error === true) throw new Error(data.message || "Backend signal error.");

        const direction = getDirection(data);

        const allowedDirections = ["LONG", "SHORT", "NO_TRADE", "WAIT_SHORT", "WAIT_LONG"];

        if (!allowedDirections.includes(direction)) {
            throw new Error("Backend returned an invalid signal direction.\n\nReceived: " +
                JSON.stringify(data.direction ?? data.signalDirection ?? data.signal ?? null));
        }

        if (direction === "WAIT_SHORT" || direction === "WAIT_LONG") {
            const realDir = data.signalDirection || direction.replace("WAIT_", "");
            const waitReasoning = getReasoning(data);

            document.getElementById("resGenTime").innerText = formatDate(new Date());
            document.getElementById("resValidTime").innerText = "WAIT MODE";
            document.getElementById("resPrice").innerText = "$" + formatPrice(currentPrice);
            document.getElementById("resIndicators").innerText = "RSI: " + data1.rsi.toFixed(2) + " | MACD: " + formatMacd(data1.macd);

            const waitStatus = data.entryStatus || "WAIT_PULLBACK";
            const plannedEntry = safeNumber(data.suggestedEntry, 0);
            let waitEntryText = "\u23f3 Wait for Pullback";
            if (waitStatus === "WAIT_BETTER_RR") waitEntryText = "\u23f3 Wait for Better Setup";
            else if (waitStatus === "WAIT_COUNTER_TREND") waitEntryText = "\u23f3 Wait \u2014 Counter-Trend Risk";

            if (plannedEntry > 0 && waitStatus !== "WAIT_BETTER_RR") {
                waitEntryText += " (~$" + formatPrice(plannedEntry) + ")";
            }

            let waitRR = "N/A";
            if (data.trade && Number.isFinite(Number(data.trade.rr)) && data.trade.minRR) {
                waitRR = "1:" + Number(data.trade.rr).toFixed(2) + " (min 1:" + data.trade.minRR + ")";
            }

            document.getElementById("resEntry").innerText = waitEntryText;
            document.getElementById("resSl").innerText = "N/A";
            document.getElementById("resTp").innerText = "N/A";
            document.getElementById("resRR").innerText = waitRR;

            const dirEl = document.getElementById("resDirection");
            const decEl = document.getElementById("resDecision");

            dirEl.innerText = realDir;
            dirEl.className = realDir === "LONG" ? "dir-long" : "dir-short";

            if (decEl) {
                decEl.innerText = "\u23f3 WAIT";
                decEl.style.color = "#ffcc00";
            }

            const confValue = (data.entryConfidence || data.confidence || 40) + "%";
            document.getElementById("resConfidence").innerText = confValue;
            document.getElementById("resModel").innerText = (data.model || "AI") + " \u2014 WAIT mode";
            document.getElementById("resReason").innerText = waitReasoning;

            const waitQualityRow = document.getElementById("qualityRow");
            const waitResQuality = document.getElementById("resQuality");

            if (waitQualityRow && waitResQuality) {
                waitResQuality.innerText = "\u23f3 WAIT";
                waitResQuality.style.color = "#ffcc00";
                waitQualityRow.style.display = "flex";
            }

            if (data.signalsLeft !== undefined) {
                document.getElementById("quotaDisplay").innerText = data.signalsLeft;
                updateWatchAdButton(data.signalsLeft);
            }

            let warningText;
            if (data.entryStatus === "WAIT_BETTER_RR") {
                warningText = "\u26a0\ufe0f " + realDir + " trend confirm hai, lekin Risk/Reward kam hai.\n\nBehtar entry ya setup ka wait karein.";
            } else if (data.entryStatus === "WAIT_COUNTER_TREND") {
                warningText = "\u26a0\ufe0f " + realDir + " signal higher timeframe ke khilaf hai aur RSI extreme zone mein hai.\n\nPullback ya confirmed continuation ka wait karein.";
            } else {
                warningText = "\u26a0\ufe0f " + realDir + " trend confirm hai, lekin entry timing abhi sahi nahi.\n\nPullback ya confirmed continuation ka wait karein.";
            }

            if (data.overextension && data.overextension.reason) {
                warningText += "\n\n\ud83d\udcca Overextension: " + data.overextension.reason;
            }
            if (data.htfConflict && data.htfConflict.reason) {
                warningText += "\n\n\u26a1 HTF Conflict: " + data.htfConflict.reason;
            }
            if (data.signalQualityDetails && /^Quality gate/i.test(String(data.signalQualityDetails))) {
                warningText += "\n\n\ud83d\udd12 " + String(data.signalQualityDetails).replace(/^Quality gate:\s*/i, "Quality Gate: ");
            }

            warningBox.innerText = warningText;
            warningBox.style.display = "block";

            clearMainChartLines();

            loading.style.display = "none";
            resultBox.style.display = "block";

            showWaitFor(data);
            return;
        }

        const entry = getEntry(data, currentPrice);
        const stopLoss = getStopLoss(data);
        const takeProfit = getTakeProfit(data);

        if (direction !== "NO_TRADE") {
            if (entry <= 0 || stopLoss <= 0 || takeProfit <= 0) {
                throw new Error("Backend ne valid Entry / Stop Loss / Take Profit return nahi kiya.");
            }
        }

        document.getElementById("resGenTime").innerText = formatDate(new Date());
        document.getElementById("resValidTime").innerText = direction === "NO_TRADE" ? "N/A" : formatDate(new Date(Date.now() + 120 * 60000));
        document.getElementById("resPrice").innerText = "$" + formatPrice(currentPrice);
        document.getElementById("resIndicators").innerText = "RSI: " + data1.rsi.toFixed(2) + " | MACD: " + formatMacd(data1.macd);
        document.getElementById("resEntry").innerText = direction === "NO_TRADE" ? "N/A" : "$" + formatPrice(entry);
        document.getElementById("resSl").innerText = (direction === "NO_TRADE" && stopLoss === 0) ? "N/A" : "$" + formatPrice(stopLoss);
        document.getElementById("resTp").innerText = (direction === "NO_TRADE" && takeProfit === 0) ? "N/A" : "$" + formatPrice(takeProfit);

        const dirEl = document.getElementById("resDirection");
        const decEl = document.getElementById("resDecision");

        const displayDirection = data.signalDirection || direction;
        dirEl.innerText = displayDirection;
        dirEl.className = displayDirection === "LONG" ? "dir-long" :
            (displayDirection === "SHORT" ? "dir-short" : "dir-notrade");

        if (decEl) {
            let decisionText = direction;
            let decisionColor = "#a0a0b5";

            if (direction === "LONG" || direction === "SHORT") {
                decisionText = "\u2705 READY";
                decisionColor = "#00ff88";
            } else if (direction === "NO_TRADE") {
                decisionText = "\u26d4 NO_TRADE";
                decisionColor = "#ffcc00";
            }

            decEl.innerText = decisionText;
            decEl.style.color = decisionColor;
        }

        let rrValue = data.rr ?? data.riskReward ?? data.risk_reward ?? "N/A";
        if (direction !== "NO_TRADE" && (rrValue === "N/A" || rrValue === "" || rrValue === null)) {
            const risk = Math.abs(entry - stopLoss);
            const reward = Math.abs(takeProfit - entry);
            if (risk > 0 && reward > 0) rrValue = "1:" + (reward / risk).toFixed(2);
        }
        document.getElementById("resRR").innerText = rrValue;
        document.getElementById("resConfidence").innerText = getConfidence(data);
        document.getElementById("resModel").innerText = data.model || data.modelUsed || data.engine || "Core-Quant-Engine";
        document.getElementById("resReason").innerText = getReasoning(data);

        const qualityRow = document.getElementById("qualityRow");
        const resQuality = document.getElementById("resQuality");

        if (qualityRow && resQuality && data.signalQuality) {
            const q = data.signalQuality;
            let qualityText = q;
            let qualityColor = "#a0a0b5";

            if (q === "STRONG") {
                qualityText = "\ud83d\udfe2 STRONG" + (data.signalQualityScore ? " (" + data.signalQualityScore + ")" : "");
                qualityColor = "#00ff88";
            } else if (q === "MODERATE") {
                qualityText = "\ud83d\udfe1 MODERATE" + (data.signalQualityScore ? " (" + data.signalQualityScore + ")" : "");
                qualityColor = "#ffcc00";
            } else if (q === "WEAK") {
                qualityText = "\ud83d\udd34 WEAK" + (data.signalQualityScore ? " (" + data.signalQualityScore + ")" : "");
                qualityColor = "#ff4d4d";
            } else if (q === "WAIT") {
                qualityText = "\u23f3 WAIT";
                qualityColor = "#ffcc00";
            }

            resQuality.innerText = qualityText;
            resQuality.style.color = qualityColor;
            qualityRow.style.display = "flex";
        } else if (qualityRow) {
            qualityRow.style.display = "none";
        }

        if (data.signalsLeft !== undefined) {
            document.getElementById("quotaDisplay").innerText = data.signalsLeft;
            updateWatchAdButton(data.signalsLeft);
        }

        if (data.warnings) {
            let warningText = Array.isArray(data.warnings) ? data.warnings.join(" ") : String(data.warnings);
            if (warningText.trim()) {
                warningBox.innerText = warningText;
                warningBox.style.display = "block";
            }
        }

        if (direction === "LONG" || direction === "SHORT") {
            addMainChartLines(entry, stopLoss, takeProfit, direction);
        } else {
            clearMainChartLines();
            showWaitFor(data);
        }

        loading.style.display = "none";
        resultBox.style.display = "block";

    } catch (error) {
        loading.style.display = "none";
        errorBox.innerText = "\u274c " + (error.message || "Unknown error");
        errorBox.style.display = "block";
    } finally {
        clearInterval(loadInterval);
        button.disabled = false;
    }
}


/* =========================================================
   LIVE CHART
========================================================= */
let mainChart = null;
let mainCandleSeries = null;
let mainVolumeSeries = null;
let mainVolumeChart = null;
let mainPriceLines = [];
let mainChartSymbol = "BTCUSDT";
let mainChartTimeframe = "1h";
let mainLastPrice = 0;
let mainChartInit = false;


function initMainChart() {
    const container = document.getElementById("mainChartContainer");
    const volumeContainer = document.getElementById("mainVolumeContainer");

    if (!container || !volumeContainer) return;

    if (mainChart) {
        try { mainChart.remove(); } catch (e) { }
    }
    if (mainVolumeChart) {
        try { mainVolumeChart.remove(); } catch (e) { }
    }

    mainChart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: { background: { color: "#151a28" }, textColor: "#a0a0b5" },
        grid: { vertLines: { color: "#232b3e" }, horzLines: { color: "#232b3e" } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#232b3e" },
        timeScale: { borderColor: "#232b3e", timeVisible: true, secondsVisible: false, visible: false }
    });

    mainCandleSeries = mainChart.addCandlestickSeries({
        upColor: "#00ff88", downColor: "#ff4d4d",
        borderUpColor: "#00ff88", borderDownColor: "#ff4d4d",
        wickUpColor: "#00ff88", wickDownColor: "#ff4d4d"
    });

    mainVolumeChart = LightweightCharts.createChart(volumeContainer, {
        width: volumeContainer.clientWidth,
        height: volumeContainer.clientHeight,
        layout: { background: { color: "#151a28" }, textColor: "#a0a0b5" },
        grid: { vertLines: { color: "#232b3e" }, horzLines: { color: "#232b3e" } },
        rightPriceScale: { borderColor: "#232b3e", scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: "#232b3e", timeVisible: true, secondsVisible: false }
    });

    mainVolumeSeries = mainVolumeChart.addHistogramSeries({
        color: "#26a69a",
        priceFormat: { type: "volume" },
        priceScaleId: ""
    });

    mainChart.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
        if (r) mainVolumeChart.timeScale().setVisibleLogicalRange(r);
    });
    mainVolumeChart.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
        if (r) mainChart.timeScale().setVisibleLogicalRange(r);
    });

    window.addEventListener("resize", function () {
        if (mainChart) mainChart.applyOptions({ width: container.clientWidth });
        if (mainVolumeChart) mainVolumeChart.applyOptions({ width: volumeContainer.clientWidth });
    });

    mainChartInit = true;
}


async function loadMainChartData(symbol, timeframe) {
    try {
        if (!mainChartInit) initMainChart();

        document.getElementById("chartLoadingMini").style.display = "block";

        const url = "https://fapi.binance.com/fapi/v1/klines?symbol=" + symbol +
            "&interval=" + timeframe + "&limit=300";

        const response = await fetch(url);
        if (!response.ok) throw new Error("Binance error");

        const data = await response.json();

        const candles = [];
        const volumes = [];

        let lastTime = 0;

        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            let time = Math.floor(d[0] / 1000);

            if (time <= lastTime) time = lastTime + 1;
            lastTime = time;

            const open = parseFloat(d[1]);
            const high = parseFloat(d[2]);
            const low = parseFloat(d[3]);
            const close = parseFloat(d[4]);
            const volume = parseFloat(d[5]);

            candles.push({ time, open, high, low, close });
            volumes.push({
                time, value: volume,
                color: close >= open ? "rgba(0, 255, 136, 0.5)" : "rgba(255, 77, 77, 0.5)"
            });
        }

        mainCandleSeries.setData(candles);
        mainVolumeSeries.setData(volumes);
        mainChart.timeScale().fitContent();

        const latest = candles[candles.length - 1];
        mainLastPrice = latest.close;

        const pricePrecision = getPricePrecision(latest.close);
        mainCandleSeries.applyOptions({
            priceFormat: { type: "price", precision: pricePrecision, minMove: Math.pow(10, -pricePrecision) }
        });

        updateMainChartPrice(latest.close, candles);
        updateMainChartIndicators(candles);

        document.getElementById("chartLoadingMini").style.display = "none";
        document.getElementById("chartInfoMini").innerText =
            symbol + " | " + timeframe + " | " + candles.length + " candles";

        return candles;

    } catch (error) {
        document.getElementById("chartLoadingMini").style.display = "none";
        document.getElementById("chartInfoMini").innerText = "\u274c " + error.message;
        return null;
    }
}


function updateMainChartPrice(price, candles) {
    let priceStr;
    if (price >= 1000) priceStr = "$" + price.toFixed(2);
    else if (price >= 1) priceStr = "$" + price.toFixed(4);
    else priceStr = "$" + price.toFixed(6);

    document.getElementById("chartLivePrice").textContent = priceStr;

    if (candles && candles.length >= 24) {
        const oldPrice = candles[candles.length - 24].close;
        const change = ((price - oldPrice) / oldPrice) * 100;
        const el = document.getElementById("chartPriceChange");

        if (change >= 0) {
            el.textContent = "\u25B2 " + change.toFixed(2) + "%";
            el.className = "chart-price-change up";
        } else {
            el.textContent = "\u25BC " + Math.abs(change).toFixed(2) + "%";
            el.className = "chart-price-change down";
        }
    }
}


function updateMainChartIndicators(candles) {
    const closes = candles.map(c => c.close);

    const rsi = calculateRSI(closes, 14);
    const rsiEl = document.getElementById("chartRsi");
    rsiEl.textContent = rsi.toFixed(2);

    if (rsi >= 70) rsiEl.className = "chart-ind-value negative";
    else if (rsi <= 30) rsiEl.className = "chart-ind-value positive";
    else rsiEl.className = "chart-ind-value";

    const macdData = calculateMACD(closes);
    const macdEl = document.getElementById("chartMacd");
    macdEl.textContent = formatMacd(macdData.macd);

    if (macdData.macd > macdData.signal) macdEl.className = "chart-ind-value positive";
    else macdEl.className = "chart-ind-value negative";
}


function addMainChartLines(entry, stopLoss, takeProfit, direction) {
    if (!mainCandleSeries) return;
    clearMainChartLines();
    if (direction === "NO_TRADE" || !entry || !stopLoss || !takeProfit) return;

    const entryLine = mainCandleSeries.createPriceLine({
        price: entry, color: "#00d2ff", lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true, title: "Entry"
    });
    mainPriceLines.push(entryLine);

    const slLine = mainCandleSeries.createPriceLine({
        price: stopLoss, color: "#ff4d4d", lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true, title: "SL"
    });
    mainPriceLines.push(slLine);

    const tpLine = mainCandleSeries.createPriceLine({
        price: takeProfit, color: "#00ff88", lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true, title: "TP"
    });
    mainPriceLines.push(tpLine);

    document.getElementById("chartInfoMini").textContent =
        "\u2705 " + direction + " | Entry: " + entry + " | SL: " + stopLoss + " | TP: " + takeProfit;
}


function hideWaitFor() {
    const box = document.getElementById("waitForBox");
    if (box) {
        box.style.display = "none";
        box.innerHTML = "";
    }
}

function addWaitForLine(price, color, title, lineStyle) {
    const p = Number(price);
    if (!mainCandleSeries || !Number.isFinite(p) || p <= 0) return;
    try {
        const line = mainCandleSeries.createPriceLine({
            price: p, color: color, lineWidth: 1,
            lineStyle: lineStyle,
            axisLabelVisible: true, title: title
        });
        mainPriceLines.push(line);
    } catch (e) { }
}

function showWaitFor(data) {
    const box = document.getElementById("waitForBox");
    if (!box) return;

    box.innerHTML = "";
    const w = data && data.waitFor;

    if (!w || !Array.isArray(w.lines) || w.lines.length === 0) {
        box.style.display = "none";
        return;
    }

    const title = document.createElement("div");
    title.className = "waitfor-title";
    title.textContent = "\u23f3 Wait for:";
    box.appendChild(title);

    w.lines.forEach(function (text) {
        const row = document.createElement("div");
        row.className = "waitfor-line";
        row.textContent = String(text);
        box.appendChild(row);
    });

    const note = document.createElement("div");
    note.className = "waitfor-note";
    note.textContent = "Ye signal nahi, sirf watch-list hai. Levels har naye analysis par dobara nikalte hain.";
    box.appendChild(note);

    box.style.display = "block";

    const sameCoin = String(mainChartSymbol || "").toUpperCase() === String(data.symbol || "").toUpperCase();
    if (sameCoin && mainCandleSeries && typeof LightweightCharts !== "undefined") {
        addWaitForLine(w.longTrigger, "#00ff88", "LONG >", LightweightCharts.LineStyle.Dashed);
        addWaitForLine(w.shortTrigger, "#ff4d4d", "SHORT <", LightweightCharts.LineStyle.Dashed);

        const zone = w.rejectionZone || w.pullbackZone;
        if (zone) {
            addWaitForLine(zone.high, "#ffcc00", "Zone", LightweightCharts.LineStyle.Dotted);
            addWaitForLine(zone.low, "#ffcc00", "", LightweightCharts.LineStyle.Dotted);
        }
    }
}

function clearMainChartLines() {
    if (!mainCandleSeries) return;
    mainPriceLines.forEach(function (line) {
        try { mainCandleSeries.removePriceLine(line); } catch (e) { }
    });
    mainPriceLines = [];
}


/* =========================================================
   LIVE UPDATE (har 10 sec)
========================================================= */
async function updateMainChartLastCandle() {
    if (!mainCandleSeries || !mainChartInit) return;

    const currentSymbol = mainChartSymbol;
    const currentTimeframe = mainChartTimeframe;

    try {
        const url = "https://fapi.binance.com/fapi/v1/klines?symbol=" + currentSymbol +
            "&interval=" + currentTimeframe + "&limit=2";

        const response = await fetch(url);
        if (!response.ok) return;

        const data = await response.json();

        if (currentSymbol !== mainChartSymbol) return;

        const last = data[data.length - 1];

        const candle = {
            time: Math.floor(last[0] / 1000),
            open: parseFloat(last[1]),
            high: parseFloat(last[2]),
            low: parseFloat(last[3]),
            close: parseFloat(last[4])
        };

        mainCandleSeries.update(candle);

        mainVolumeSeries.update({
            time: candle.time,
            value: parseFloat(last[5]),
            color: candle.close >= candle.open ? "rgba(0, 255, 136, 0.5)" : "rgba(255, 77, 77, 0.5)"
        });

        updateMainChartPrice(candle.close);
        mainLastPrice = candle.close;

    } catch (e) { }
}


/* =========================================================
   FULLSCREEN
========================================================= */
function toggleChartFullscreen() {
    const section = document.getElementById("liveChartSection");
    section.classList.toggle("chart-fullscreen-mode");

    setTimeout(function () {
        if (mainChart) mainChart.applyOptions({ width: document.getElementById("mainChartContainer").clientWidth });
        if (mainVolumeChart) mainVolumeChart.applyOptions({ width: document.getElementById("mainVolumeContainer").clientWidth });
    }, 100);
}

function toggleChartCollapse() {
    const section = document.getElementById("liveChartSection");
    const chartWrap = section.querySelector(".chart-wrap");
    const priceRow = section.querySelector(".chart-price-row");
    const indicators = section.querySelector(".chart-indicators");
    const infoMini = section.querySelector(".chart-info-mini");
    const arrow = document.getElementById("chartCollapseArrow");

    if (!chartWrap) return;

    const isHidden = chartWrap.style.display === "none";

    if (isHidden) {
        chartWrap.style.display = "";
        if (priceRow) priceRow.style.display = "";
        if (indicators) indicators.style.display = "";
        if (infoMini) infoMini.style.display = "";
        arrow.style.transform = "rotate(0deg)";
    } else {
        chartWrap.style.display = "none";
        if (priceRow) priceRow.style.display = "none";
        if (indicators) indicators.style.display = "none";
        if (infoMini) infoMini.style.display = "none";
        arrow.style.transform = "rotate(-90deg)";
    }
}

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        const section = document.getElementById("liveChartSection");
        if (section && section.classList.contains("chart-fullscreen-mode")) {
            toggleChartFullscreen();
        }
    }
});


/* =========================================================
   WATCH AD → GET EXTRA SIGNAL
========================================================= */
async function watchAdForSignal() {
    if (!activeUser) {
        alert("Pehle login karein.");
        return;
    }

    const btn = document.getElementById("watchAdBtn");
    if (!btn) return;

    if (!confirm("Ad dekhein aur +1 signal payen?\n\nAd 15-30 second ki hogi. Ad complete karne ke baad signal milega.")) {
        return;
    }

    btn.disabled = true;
    btn.innerText = "⏳ Ad load ho rahi hai...";

    try {
        triggerMonetagAd();

        await new Promise(resolve => setTimeout(resolve, 20000));

        const response = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "watch_ad_reward",
                username: activeUser,
                userId: activeUser,
                deviceId: getDeviceId()
            })
        });

        const data = await response.json();

        if (data.error) {
            alert("⚠️ " + (data.message || "Reward nahi mila."));
            return;
        }

        alert("🎉 Mubarak ho! +1 signal mil gaya.");
        document.getElementById("quotaDisplay").innerText = data.signalsLeft;
        btn.style.display = "none";

    } catch (e) {
        console.log("Watch ad error:", e);
        alert("⚠️ Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "🎁 Watch Ad → Get +1 Signal";
    }
}


/* =========================================================
   MONETAG VIGNETTE AD TRIGGER
========================================================= */
function triggerMonetagAd() {
    console.log("📺 Ad trigger — tag already in head");
    // Kuch nahi — tag index.html mein hai
}

/* =========================================================
   WATCH AD BUTTON VISIBILITY
========================================================= */
function updateWatchAdButton(quota) {
    const btn = document.getElementById("watchAdBtn");
    if (!btn) return;

    if (quota <= 0) {
        btn.style.display = "block";
    } else {
        btn.style.display = "none";
    }
}


/* =========================================================
   OUTCOME TRACKER
========================================================= */
async function runOutcomeTracker() {
    try {
        updateLoadStep(3, "active");

        const lockResponse = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "check_lock", outcomeKey: OUTCOME_KEY })
        });

        const lockData = await lockResponse.json();

        if (!lockData.canRun) {
            console.log("\u23f3 30 minute nahi guzre, outcome check skip");
            updateLoadStep(3, "done");
            return;
        }

        await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "set_lock", outcomeKey: OUTCOME_KEY })
        });

        const signalsResponse = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "get_open_signals", outcomeKey: OUTCOME_KEY })
        });

        const signalsData = await signalsResponse.json();

        if (!signalsData.signals || signalsData.signals.length === 0) {
            console.log("\u2705 Koi OPEN signal nahi");
            updateLoadStep(3, "done");
            return;
        }

        console.log("\ud83d\udcca " + signalsData.signals.length + " OPEN signals mile");

        for (const signal of signalsData.signals) {
            await checkSingleOutcome(signal);
        }

        updateLoadStep(3, "done");

    } catch (e) {
        console.error("Outcome tracker error:", e);
        updateLoadStep(3, "done");
    }
}


async function checkSingleOutcome(signal) {
    try {
        const startTime = new Date(signal.timestamp).getTime();
        const endLimit = startTime + 48 * 60 * 60 * 1000;
        const url = "https://fapi.binance.com/fapi/v1/klines" +
            "?symbol=" + signal.symbol +
            "&interval=" + signal.timeframe +
            "&startTime=" + startTime +
            "&endTime=" + endLimit +
            "&limit=1000";

        const response = await fetch(url);
        if (!response.ok) return;

        const candles = await response.json();
        if (!Array.isArray(candles) || candles.length === 0) return;

        let outcome = "OPEN";
        let closedPrice = 0;
        let closedTime = "";

        for (const candle of candles) {
            const high = parseFloat(candle[2]);
            const low = parseFloat(candle[3]);
            const time = new Date(candle[6]).toISOString();

            if (signal.direction === "LONG") {
                if (low <= signal.stopLoss) {
                    outcome = "LOSS"; closedPrice = signal.stopLoss; closedTime = time; break;
                }
                if (high >= signal.takeProfit) {
                    outcome = "WIN"; closedPrice = signal.takeProfit; closedTime = time; break;
                }
            } else if (signal.direction === "SHORT") {
                if (high >= signal.stopLoss) {
                    outcome = "LOSS"; closedPrice = signal.stopLoss; closedTime = time; break;
                }
                if (low <= signal.takeProfit) {
                    outcome = "WIN"; closedPrice = signal.takeProfit; closedTime = time; break;
                }
            }
        }

        if (outcome === "OPEN" && Date.now() > endLimit) {
            outcome = "EXPIRED";
            closedPrice = 0;
            closedTime = new Date().toISOString();
        }

        if (outcome !== "OPEN") {
            console.log("\u2705 " + signal.symbol + " " + signal.direction + " \u2192 " + outcome);

            await fetch(scriptURL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "update_outcome",
                    outcomeKey: OUTCOME_KEY,
                    row: signal.row,
                    outcome: outcome,
                    closedPrice: closedPrice,
                    closedTime: closedTime
                })
            });
        }

    } catch (e) {
        console.error("Single outcome error:", e);
    }
}


/* =========================================================
   LOADING POPUP HELPERS
========================================================= */
function updateLoadStep(step, status) {
    const el = document.getElementById("loadStep" + step);
    if (!el) return;

    if (status === "active") {
        el.style.opacity = "1";
    } else if (status === "done") {
        el.innerHTML = "\u2705 " + el.innerHTML.replace(/^\S+\s+/, "");
        el.style.color = "#00ff88";
    }
}


function hideLoadingPopup() {
    const popup = document.getElementById("loadingPopup");
    if (popup) {
        popup.style.transition = "opacity 0.5s ease";
        popup.style.opacity = "0";
        setTimeout(function () {
            popup.style.display = "none";
        }, 500);
    }
}

// Service Worker ko turant update karo
import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log("🔄 Naya version available hai, auto-update ho raha hai...");
  },
  onOfflineReady() {
    console.log("✅ App offline ready hai");
  }
});
/* =========================================================
   DOMContentLoaded
========================================================= */
document.addEventListener("DOMContentLoaded", function () {

    (async function () {
        try {
            updateLoadStep(1, "active");

            if (activeUser) {
                document.getElementById("loginModal").style.display = "none";
                document.getElementById("userIdDisplay").innerText = activeUser;
                refreshQuota();
                loadReferralInfo();
                loadShareStatus();
            } else {
                document.getElementById("loginModal").style.display = "flex";
                hideLoadingPopup();
                return;
            }

            await new Promise(function (resolve) {
                setTimeout(function () {
                    initMainChart();
                    loadMainChartData(mainChartSymbol, mainChartTimeframe);
                    updateLoadStep(2, "active");
                    setTimeout(function () {
                        updateLoadStep(2, "done");
                        resolve();
                    }, 1500);
                }, 500);
            });

            await runOutcomeTracker();
            loadAccuracyStats();

            updateLoadStep(4, "active");
            updateLoadStep(4, "done");

            setTimeout(hideLoadingPopup, 500);

        } catch (e) {
            console.error("Load sequence error:", e);
            hideLoadingPopup();
        }
    })();

    setTimeout(function () {
        setInterval(updateMainChartLastCandle, 10000);
    }, 3000);

    const coinSelect = document.getElementById("coinSelect");
    if (coinSelect) {
        coinSelect.addEventListener("change", function () {
            mainChartSymbol = this.value;
            clearMainChartLines();
            loadMainChartData(mainChartSymbol, mainChartTimeframe);
        });
    }

    const tfSelect = document.getElementById("timeframeSelect");
    if (tfSelect) {
        tfSelect.addEventListener("change", function () {
            mainChartTimeframe = this.value;
            clearMainChartLines();
            loadMainChartData(mainChartSymbol, mainChartTimeframe);
        });
    }

    const suggestionText = document.getElementById("suggestionText");
    if (suggestionText) {
        suggestionText.addEventListener("input", updateSuggestionCharCount);
    }
});


/* =========================================================
   GLOBAL EXPORTS
========================================================= */
window.performAuth = performAuth;
window.toggleSidebar = toggleSidebar;
window.logoutUser = logoutUser;
window.openWhatsApp = openWhatsApp;
window.copyReferralCode = copyReferralCode;
window.shareAndClaim = shareAndClaim;
window.submitSuggestion = submitSuggestion;
window.openPremiumModal = openPremiumModal;
window.closePremiumModal = closePremiumModal;
window.redeemPremiumCode = redeemPremiumCode;
window.toggleChartFullscreen = toggleChartFullscreen;
window.toggleChartCollapse = toggleChartCollapse;
window.fetchAdvancedSignal = fetchAdvancedSignal;
window.watchAdForSignal = watchAdForSignal;
window.triggerMonetagAd = triggerMonetagAd;
window.updateWatchAdButton = updateWatchAdButton;