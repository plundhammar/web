const API_URL =
  'https://script.google.com/macros/s/AKfycbyXiiXDjZI-RC7TYrfUQCuJ_gQ-P2rjAVxm10Vc7YLzGZ2-_oSSJoE2HqRmOYsbQ_8b/exec?game=backgammon';

let archiveData = null;
let activeView = 'overview';

const output = document.querySelector('#terminal-output');
const status = document.querySelector('#connection-status');
const refreshButton = document.querySelector('#refresh-button');
const navButtons = [...document.querySelectorAll('[data-view]')];
const rollDiceButton = document.querySelector('#roll-dice-button');
const diceRollCounter = document.querySelector('#dice-roll-counter');
const lastDie = document.querySelector('#last-die');

const DICE_COUNT_URL =
  'https://script.google.com/macros/s/AKfycbyXiiXDjZI-RC7TYrfUQCuJ_gQ-P2rjAVxm10Vc7YLzGZ2-_oSSJoE2HqRmOYsbQ_8b/exec?action=dice-count';

const ROLL_DICE_URL =
  'https://script.google.com/macros/s/AKfycbyXiiXDjZI-RC7TYrfUQCuJ_gQ-P2rjAVxm10Vc7YLzGZ2-_oSSJoE2HqRmOYsbQ_8b/exec?action=roll-dice';
async function loadDiceRollCount() {
  if (!diceRollCounter) {
    return;
  }

  try {
    const response = await fetch(DICE_COUNT_URL, {
      cache: 'no-store',
    });

    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.error || 'Kunde inte registrera tärningskast.');
    }

    diceRollCounter.textContent = formatCounter(payload.count);
  } catch (error) {
    console.error(error);
    diceRollCounter.textContent = '??????';
  }
}


async function rollDice() {
  if (!rollDiceButton || !diceRollCounter || !lastDie) {
    return;
  }

  const lastRollAt = Number(
    localStorage.getItem('backgammon_last_dice_roll_at') || 0
  );

  const now = Date.now();

  if (now - lastRollAt < 2_000) {
    return;
  }

  rollDiceButton.disabled = true;
  rollDiceButton.textContent = 'Rullar...';

  try {
    const dieValue = Math.floor(Math.random() * 6) + 1;

    // Visar kastet direkt och låter det ligga kvar.
    lastDie.textContent = dieFace(dieValue);
    lastDie.setAttribute(
      'aria-label',
      `Senaste tärningskast: ${dieValue}`
    );

    const response = await fetch(ROLL_DICE_URL, {
      method: 'POST',
      cache: 'no-store',
    });

    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.error || 'Kune inte registrera tärningskastet.');
    }

    localStorage.setItem(
      'backgammon_last_dice_roll_at',
      String(now)
    );

    // Uppdaterar bara räknaren. Tärningen ligger kvar.
    diceRollCounter.textContent = formatCounter(payload.count);
  } catch (error) {
    console.error(error);
    lastDie.textContent = '!';
    lastDie.setAttribute(
      'aria-label',
      'Kunde inte registrera tärningskastet'
    );
  } finally {
    window.setTimeout(() => {
      rollDiceButton.disabled = false;
      rollDiceButton.textContent = 'Rulla tärning';
    }, 900);
  }
}


function formatCounter(value) {
  return String(Number(value) || 0).padStart(8, '0');
}

async function loadArchive() {
  status.textContent = 'Ansluter till spelarkivet…';
  output.textContent = 'Laddar arkiv…';

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API returned HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.error || 'Unknown API error');
    }

    archiveData = payload;
    status.textContent =
  `Spelarkivet är uppdaterat · ${formatGeneratedAt(payload.generatedAt)}`;

    renderActiveView();
  } catch (error) {
    console.error(error);

    status.textContent = 'Spelarkivet kunde inte laddas';
    output.innerHTML = `
      <h2 class="section-title">CONNECTION ERROR</h2>
      <p>Could not load the game archive.</p>
      <p class="muted">${escapeHtml(error.message)}</p>
    `;
  }
}

function dieFace(value) {
  const faces = {
    1: `   1
+-----+
|     |
|  o  |
|     |
+-----+`,

    2: `   2
+-----+
|  o  |
|     |
|  o  |
+-----+ `,

    3: `   3
+-----+
|  o  |
|  o  |
|  o  |
+-----+`,

    4: `   4
+-----+
| o o |
|     |
| o o |
+-----+`,

    5: `   5
+-----+
| o o |
|  o  |
| o o |
+-----+`,

    6: `   6
+-----+
| o o |
| o o |
| o o |
+-----+`,
  };

  return faces[value] || '?';
}

function renderActiveView() {
  if (!archiveData) {
    return;
  }

  if (activeView === 'recent') {
    renderRecentGames();
    return;
  }

  if (activeView === 'locations') {
    renderLocations();
    return;
  }

  if (activeView === 'awards') {
    renderAwards();
    return;
  }

  renderOverview();
}

function renderOverview() {
  const { overview } = archiveData;
  const alice = overview.players.Alice || emptyPlayer();
  const per = overview.players.Per || emptyPlayer();

  output.innerHTML = `
    <h2 class="section-title">BACKGAMMON // TOTALT</h2>

    <div class="stats-grid">
      ${statCard('Antal spel', overview.totalGames)}
      ${statCard('Första spel', overview.firstGameDate || '—')}
      ${statCard('Senaste spel', overview.latestGameDate || '—')}
      ${statCard(
        'Nuvarande vinstsvit',
        overview.currentStreak
          ? `${escapeHtml(overview.currentStreak.player)} × ${overview.currentStreak.length}`
          : '—'
      )}
    </div>

    <div class="player-row">
      <strong class="player-name--alice">ALICE</strong>
      <span>${alice.wins} wins</span>
      <span>${alice.points} pts · ${alice.winRate}%</span>
    </div>

    <div class="player-row">
      <strong class="player-name--per">PER</strong>
      <span>${per.wins} wins</span>
      <span>${per.points} pts · ${per.winRate}%</span>
    </div>
  `;
}


function renderRecentGames() {
  const games = archiveData.recentGames || [];

  output.innerHTML = `
    <h2 class="section-title">SENASTE SPEL</h2>
    ${
      games.length
        ? games.map(renderGameRow).join('')
        : '<p class="muted">Inga spel registrerade ännu.</p>'
    }
  `;
}


function renderLocations() {
  const locations = archiveData.locations || [];

  output.innerHTML = `
    <h2 class="section-title">PLATSER</h2>
    ${
      locations.length
        ? locations.map(renderLocationRow).join('')
        : '<p class="muted">Inga platser registrerade ännu.</p>'
    }
  `;
}

function renderAwards() {
  const awards = archiveData.awards;

  if (!awards) {
    output.innerHTML = `
      <h2 class="section-title">UTMÄRKELSER</h2>
      <p class="muted">Utmärkelser kunde inte laddas.</p>
    `;
    return;
  }

  const { diceFavorite, revengeKing } = awards;

  output.innerHTML = `
    <h2 class="section-title">BACKGAMMON-UTMÄRKELSER</h2>

    <section class="award-card award-card--dice">
      <p class="award-title">★ TÄRNINGARNAS GUNSTLING ★</p>

      <p class="award-description">
        Flest vunna poäng under de senaste
        ${diceFavorite.periodGames} spelen.
      </p>

      <p class="award-winner">
        ${escapeHtml(diceFavorite.winner)}
      </p>

      <p class="award-value">
        ${diceFavorite.winningPoints} poäng
      </p>

      <p class="award-detail muted">
        Alice: ${diceFavorite.alicePoints} poäng ·
        Per: ${diceFavorite.perPoints} poäng
      </p>
    </section>

    <section class="award-card award-card--revenge">
      <p class="award-title">★ REVANSCHMÄSTAREN ★</p>

      <p class="award-description">
        Flest vinster direkt efter en egen förlust.
      </p>

      <p class="award-winner">
        ${escapeHtml(revengeKing.winner)}
      </p>

      <p class="award-value">
        ${revengeKing.winningCount} revanscher
      </p>

      <p class="award-detail muted">
        Alice: ${revengeKing.aliceRevengeWins} ·
        Per: ${revengeKing.perRevengeWins}
      </p>
    </section>
  `;
}

function renderGameRow(game) {
  const date = formatGameDate(game.playedAt, game.datePrecision);
  const winnerClass =
    game.winner === 'Alice' ? 'player-name--alice' : 'player-name--per';

  return `
    <article class="game-row">
      <span>${escapeHtml(date)}</span>
      <span class="game-location muted">${escapeHtml(game.location)}</span>
      <strong class="${winnerClass}">
        ${escapeHtml(game.winner)} +${game.points}
      </strong>
    </article>
  `;
}


function renderLocationRow(location) {
  return `
    <article class="location-row">
      <strong>${escapeHtml(location.location)}</strong>
      <span>${location.games} games</span>
      <span class="muted">A ${location.aliceWins} · P ${location.perWins}</span>
    </article>
  `;
}


function statCard(label, value) {
  return `
    <div class="stat">
      <span class="stat-label">${escapeHtml(label)}</span>
      <strong class="stat-value">${escapeHtml(String(value))}</strong>
    </div>
  `;
}


function emptyPlayer() {
  return {
    wins: 0,
    points: 0,
    winRate: 0,
  };
}


function formatGameDate(value, precision) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Okänt datum';
  }

  const dateText = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);

  if (precision === 'date') {
    return dateText;
  }

  const timeText = new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return `${dateText} · ${timeText}`;
}


function formatGeneratedAt(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'UPPDATERAD';
  }

  return new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}


function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


navButtons.forEach(button => {
  button.addEventListener('click', () => {
    activeView = button.dataset.view;

    navButtons.forEach(item => {
      item.classList.toggle(
        'is-active',
        item.dataset.view === activeView
      );
    });

    renderActiveView();
  });
});


refreshButton.addEventListener('click', loadArchive);


document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();

  if (key === '1') {
    activeView = 'overview';
  }

  if (key === '2') {
    activeView = 'recent';
  }

  if (key === '3') {
    activeView = 'locations';
  }

  if (key === '4') {
  activeView = 'awards';
}

  if (key === 'r') {
    loadArchive();
    return;
  }

  navButtons.forEach(button => {
    button.classList.toggle(
      'is-active',
      button.dataset.view === activeView
    );
  });

  renderActiveView();
});

rollDiceButton?.addEventListener('click', rollDice);
loadDiceRollCount();
loadArchive();

