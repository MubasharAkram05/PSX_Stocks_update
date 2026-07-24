let currentMode = 'sip';

  // Page load pe daily/weekly/monthly/yearly section hide karo (default SIP mode hai)
  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('daily-ticker').style.display = 'none';
    document.getElementById('daily-row-section').style.display = 'none';
  });

  function adjustRate(delta) {
    const slider = document.getElementById('rate-slider');
    let val = parseFloat(slider.value) + delta;
    val = Math.min(30, Math.max(5, Math.round(val * 10) / 10));
    slider.value = val;
    document.getElementById('rate-display').textContent = val.toFixed(2) + '%';
  }

  function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + mode).classList.add('active');

    const lump = document.getElementById('lump-field');
    const sip = document.getElementById('sip-field');

    if (mode === 'sip') { sip.style.display = 'flex'; lump.style.display = 'none'; }
    else if (mode === 'lump') { sip.style.display = 'none'; lump.style.display = 'flex'; }
    else { sip.style.display = 'flex'; lump.style.display = 'flex'; }

    // Daily/Weekly/Monthly/Yearly section sirf One Time (lump) mode mein show ho
    const showReturns = mode === 'lump';
    document.getElementById('daily-ticker').style.display = showReturns ? '' : 'none';
    document.getElementById('daily-row-section').style.display = showReturns ? '' : 'none';
  }

  function selectFund(el, rate) {
    document.querySelectorAll('.fund-card').forEach(f => f.classList.remove('selected'));
    el.classList.add('selected');
    const slider = document.getElementById('rate-slider');
    slider.value = rate;
    document.getElementById('rate-display').textContent = rate + '%';
  }

  function fmtSmall(n) {
    if (n >= 100000) return 'Rs. ' + (n / 100000).toFixed(2) + ' Lac';
    if (n >= 1000) return 'Rs. ' + n.toFixed(0).toLocaleString('en-PK');
    return 'Rs. ' + n.toFixed(2);
  }

  function fmt(n) {
    if (n >= 10000000) return 'Rs. ' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return 'Rs. ' + (n / 100000).toFixed(2) + ' Lac';
    return 'Rs. ' + Math.round(n).toLocaleString('en-PK');
  }

  function adjustTaxRate(delta) {
    const slider = document.getElementById('cgt-rate-slider');
    let val = parseInt(slider.value) + delta;
    val = Math.min(40, Math.max(1, val));
    slider.value = val;
    document.getElementById('cgt-rate-display').textContent = val + '%';
  }

  function toggleTaxFields() {
    const enabled = document.getElementById('tax-enable').checked;
    document.getElementById('tax-fields').style.display = enabled ? '' : 'none';
  }

  function calculate() {
    const years = parseInt(document.getElementById('years').value) || 5;
    const rate = parseFloat(document.getElementById('rate-slider').value) / 100;
    const monthly = currentMode !== 'lump' ? (parseFloat(document.getElementById('monthly').value) || 0) : 0;
    const lump = currentMode !== 'sip' ? (parseFloat(document.getElementById('lumpsum').value) || 0) : 0;

    if (monthly === 0 && lump === 0) return;

    const monthlyRate = rate / 12;
    const months = years * 12;

    // Tax settings
    const taxEnabled = document.getElementById('tax-enable').checked;
    const cgtRate = taxEnabled ? (parseFloat(document.getElementById('cgt-rate-slider').value) || 15) / 100 : 0;
    const holdingExempt = taxEnabled && years > 6;
    const taxActive = taxEnabled && !holdingExempt;

    // SIP future value
    let sipFV = 0;
    if (monthly > 0 && monthlyRate > 0) {
      sipFV = monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
    } else if (monthly > 0) {
      sipFV = monthly * months;
    }

    // Lump sum future value
    const lumpFV = lump * Math.pow(1 + rate, years);

    const grossTotalFV = sipFV + lumpFV;
    const totalInvested = (monthly * months) + lump;
    const grossProfit = grossTotalFV - totalInvested;

    // Apply CGT to profit
    const cgtAmount = (taxActive && grossProfit > 0) ? grossProfit * cgtRate : 0;
    const netProfit = grossProfit - cgtAmount;
    const totalFV = totalInvested + netProfit;
    const multiplier = totalFV / totalInvested;

    // Update hero (post-tax figures)
    document.getElementById('res-total').textContent = fmt(totalFV);
    document.getElementById('res-years').textContent = years;
    document.getElementById('res-invested').textContent = fmt(totalInvested);
    document.getElementById('res-profit').textContent = fmt(netProfit);
    document.getElementById('res-multiplier').textContent = multiplier.toFixed(2) + 'x';
    document.getElementById('res-rate').textContent = (rate * 100).toFixed(2) + '% / yr';

    // Tax breakdown section
    const taxSection = document.getElementById('tax-breakdown-section');
    if (taxEnabled) {
      document.getElementById('tax-gross-profit').textContent = fmt(grossProfit);
      document.getElementById('tax-cgt').textContent = cgtAmount > 0 ? '−' + fmt(cgtAmount) : fmt(0);
      document.getElementById('tax-net-profit').textContent = fmt(netProfit);
      document.getElementById('tax-gross-value').textContent = fmt(grossTotalFV);
      document.getElementById('tax-holding-note').textContent = holdingExempt
        ? `✅ Holding period is ${years} years (over 6 years) — CGT exempt as per current tax law.`
        : `Held for ${years} year(s). CGT applied at ${(cgtRate*100).toFixed(0)}% since holding is under 6 years.`;
      taxSection.style.display = '';
    } else {
      taxSection.style.display = 'none';
    }

    // Daily/Weekly/Monthly/Yearly return — sirf One Time (lump) mode mein, hamesha 1 year ki FV pe
    const showReturns = currentMode === 'lump';
    document.getElementById('daily-ticker').style.display = showReturns ? '' : 'none';
    document.getElementById('daily-row-section').style.display = showReturns ? '' : 'none';

    if (showReturns) {
      // 1 year ki FV use karo (chahe years > 1 ho)
      const oneyearFV = lump * Math.pow(1 + rate, 1);
      const dailyRate = Math.pow(1 + rate, 1 / 365) - 1;
      let dailyReturn = oneyearFV * dailyRate;
      let weeklyReturn = dailyReturn * 7;
      let monthlyReturn = oneyearFV * (Math.pow(1 + rate, 1/12) - 1);
      let yearlyReturn = oneyearFV * rate;
      const dailyRatePct = (dailyRate * 100).toFixed(5);

      // Apply CGT to these projected returns too (post-tax)
      if (taxActive) {
        dailyReturn *= (1 - cgtRate);
        weeklyReturn *= (1 - cgtRate);
        monthlyReturn *= (1 - cgtRate);
        yearlyReturn *= (1 - cgtRate);
      }

      document.getElementById('res-daily').textContent = fmtSmall(dailyReturn);
      document.getElementById('res-weekly').textContent = fmtSmall(weeklyReturn);
      document.getElementById('res-monthly-ret').textContent = fmtSmall(monthlyReturn);
      document.getElementById('res-yearly-ret').textContent = fmt(yearlyReturn);
      document.getElementById('ticker-rate-info').textContent = taxEnabled
        ? `Daily Rate: ${dailyRatePct}% on ${fmt(oneyearFV)} (1st year) — after ${holdingExempt ? '0% (exempt)' : (cgtRate*100).toFixed(0)+'% CGT'}`
        : `Daily Rate: ${dailyRatePct}% on ${fmt(oneyearFV)} (1st year)`;
    }

    // Year breakdown (post-tax values per year)
    const tbody = document.getElementById('breakdown-body');
    tbody.innerHTML = '';
    let maxVal = 0;

    const yearData = [];
    for (let y = 1; y <= years; y++) {
      const m = y * 12;
      let fv = 0;
      if (monthly > 0 && monthlyRate > 0) {
        fv += monthly * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate) * (1 + monthlyRate);
      } else if (monthly > 0) {
        fv += monthly * m;
      }
      fv += lump * Math.pow(1 + rate, y);
      const inv = (monthly * m) + lump;

      let profit = fv - inv;
      if (taxEnabled) {
        const yearExempt = y > 6;
        const yearCgt = (!yearExempt && profit > 0) ? profit * cgtRate : 0;
        profit = profit - yearCgt;
        fv = inv + profit;
      }

      yearData.push({ y, fv, inv, profit });
      if (fv > maxVal) maxVal = fv;
    }

    yearData.forEach(({ y, fv, inv, profit }) => {
      const barW = Math.round((fv / maxVal) * 100);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>Year ${y}</td>
        <td>${fmt(inv)}</td>
        <td>${fmt(fv)}</td>
        <td style="color:var(--accent)">+${fmt(profit)}</td>
        <td>
          <div class="mini-bar-wrap">
            <div class="mini-bar" style="width:${barW}%"></div>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Show results
    const results = document.getElementById('results');
    results.classList.add('show');
    setTimeout(() => results.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

    // Re-trigger animation
    const hero = document.querySelector('.result-amount');
    hero.classList.remove('count-anim');
    void hero.offsetWidth;
    hero.classList.add('count-anim');
  }
