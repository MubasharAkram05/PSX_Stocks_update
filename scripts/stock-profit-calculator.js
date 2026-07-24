function fmt(n){
  const sign = n < 0 ? "-" : "";
  n = Math.abs(n);
  return sign + "Rs " + n.toLocaleString('en-PK', {maximumFractionDigits: 2});
}

// ---------- Capital Gain Calculator ----------
const buyPrice = document.getElementById('buyPrice');
const sellPrice = document.getElementById('sellPrice');
const shares = document.getElementById('shares');
const feeToggle = document.getElementById('feeToggle');
const feeFields = document.getElementById('feeFields');
const commission = document.getElementById('commission');
const cgt = document.getElementById('cgt');

feeToggle.addEventListener('change', () => {
  feeFields.classList.toggle('show', feeToggle.checked);
  document.getElementById('cgFeeRow').style.display = feeToggle.checked ? 'flex' : 'none';
  calcCapitalGain();
});

function calcCapitalGain(){
  const bp = parseFloat(buyPrice.value) || 0;
  const sp = parseFloat(sellPrice.value) || 0;
  const sh = parseFloat(shares.value) || 0;

  const investTotal = bp * sh;
  const saleTotal = sp * sh;
  let grossProfit = saleTotal - investTotal;
  let fees = 0;

  if(feeToggle.checked){
    const commRate = (parseFloat(commission.value) || 0) / 100;
    const cgtRate = (parseFloat(cgt.value) || 0) / 100;
    const commissionFee = (investTotal + saleTotal) * commRate;
    const taxFee = grossProfit > 0 ? grossProfit * cgtRate : 0;
    fees = commissionFee + taxFee;
  }

  const netProfit = grossProfit - fees;
  const pct = investTotal > 0 ? (netProfit / investTotal) * 100 : 0;

  document.getElementById('cgInvest').textContent = fmt(investTotal);
  document.getElementById('cgSale').textContent = fmt(saleTotal);
  document.getElementById('cgFees').textContent = fmt(fees);
  document.getElementById('cgProfit').textContent = fmt(netProfit);
  document.getElementById('cgProfit').className = 'val ' + (netProfit >= 0 ? 'pos' : 'neg');

  const pctPill = document.getElementById('cgPct');
  pctPill.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
  pctPill.className = 'pct-pill ' + (pct >= 0 ? 'pos' : 'neg');
}

[buyPrice, sellPrice, shares, commission, cgt].forEach(el => el.addEventListener('input', calcCapitalGain));

// ---------- Dividend Calculator ----------
const divShares = document.getElementById('divShares');
const divStockPrice = document.getElementById('divStockPrice');
const divMode = document.getElementById('divMode');
const divPercent = document.getElementById('divPercent');
const divAmount = document.getElementById('divAmount');
const divFreq = document.getElementById('divFreq');
const divPercentBox = document.getElementById('divPercentBox');
const divAmountBox = document.getElementById('divAmountBox');

const divTaxToggle = document.getElementById('divTaxToggle');
const divTaxFields = document.getElementById('divTaxFields');
const divTax = document.getElementById('divTax');
const divTaxRow = document.getElementById('divTaxRow');

divMode.addEventListener('change', () => {
  const isPercent = divMode.value === 'percent';
  divPercentBox.style.display = isPercent ? 'block' : 'none';
  divAmountBox.style.display = isPercent ? 'none' : 'block';
  calcDividend();
});

divTaxToggle.addEventListener('change', () => {
  divTaxFields.classList.toggle('show', divTaxToggle.checked);
  divTaxRow.style.display = divTaxToggle.checked ? 'flex' : 'none';
  calcDividend();
});

function calcDividend(){
  const sh = parseFloat(divShares.value) || 0;
  const price = parseFloat(divStockPrice.value) || 0;
  const freq = parseFloat(divFreq.value) || 1;

  const investTotal = sh * price;

  let perShareAnnual;
  if(divMode.value === 'percent'){
    const pct = parseFloat(divPercent.value) || 0;
    perShareAnnual = price * (pct / 100);
  } else {
    const amt = parseFloat(divAmount.value) || 0;
    perShareAnnual = amt * freq; // amount entered is PER PAYMENT, so annualize
  }

  const perSharePerPayment = perShareAnnual / freq;
  const totalPerPaymentGross = perSharePerPayment * sh;
  const totalAnnualGross = perShareAnnual * sh;

  const taxRate = divTaxToggle.checked ? (parseFloat(divTax.value) || 0) / 100 : 0;
  const taxAmountAnnual = totalAnnualGross * taxRate;
  const totalAnnualNet = totalAnnualGross - taxAmountAnnual;

  const yieldPct = price > 0 ? (totalAnnualNet / investTotal) * 100 : 0;

  const freqLabel = freq == 1 ? "saal mein 1 dafa" : freq == 2 ? "saal mein 2 dafa" : "saal mein 4 dafa";
  const totalPerPaymentNet = totalPerPaymentGross * (1 - taxRate);

  document.getElementById('divInvestTotal').textContent = fmt(investTotal);
  document.getElementById('divPerShare').textContent = fmt(perSharePerPayment) + " /share";
  document.getElementById('divPerPayment').textContent = fmt(totalPerPaymentGross);
  document.getElementById('divAnnualGross').textContent = fmt(totalAnnualGross);
  document.getElementById('divTaxAmount').textContent = fmt(taxAmountAnnual);
  document.getElementById('divAnnual').textContent = fmt(totalAnnualNet);
  document.getElementById('divYieldPct').textContent = yieldPct.toFixed(2) + '% net yield';
  document.getElementById('divFreqNote').textContent =
    `Har payment (tax ke baad): ${fmt(totalPerPaymentNet)} × ${freq} dafa (${freqLabel})`;
}

[divShares, divStockPrice, divPercent, divAmount, divFreq, divTax].forEach(el => el.addEventListener('input', calcDividend));

// Init
calcCapitalGain();
calcDividend();
