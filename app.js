// --- Global State ---

const state = {
    view: 'HOME',
    matches: [],
    activeMatchId: null,
    pendingMatchSetup: null,
    flipState: 'IDLE',
    coinSide: 'HEADS',
    tossWinner: null,
    showPlayerModal: false,
    playerModalType: '',
    playerNameInput: ''
};

// --- Initialization ---
window.onload = () => {
    loadMatches();
    render();
};

function loadMatches() {
    try {
        const saved = localStorage.getItem('cricket_scorer_html_v2_premium');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) state.matches = parsed;
        }
    } catch (e) { console.error("Load error", e); }
}

function saveMatches() {
    localStorage.setItem('cricket_scorer_html_v2_premium', JSON.stringify(state.matches));
}

function router(viewName) {
    state.view = viewName;
    render();
}

// --- Visual Effects ---
function triggerConfetti() {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const randomInRange = (min, max) => Math.random() * (max - min) + min;
    const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

function shakeElement(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('shake');
        void el.offsetWidth; // trigger reflow
        el.classList.add('shake');
    }
}

function pulseElement(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('pulse-scale');
        void el.offsetWidth; // trigger reflow
        el.classList.add('pulse-scale');
    }
}

// --- Core Logic ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const initialMatchState = {
    id: '', date: '', teamA: '', teamB: '', tossWinner: '', tossDecision: '',
    overs: 0, currentInnings: 1,
    innings: {
        1: { battingTeam: '', bowlingTeam: '', runs: 0, wickets: 0, balls: 0, extras: { wide: 0, nb: 0, lb: 0, bye: 0 }, battingStats: [], bowlingStats: [], timeline: [] },
        2: { battingTeam: '', bowlingTeam: '', runs: 0, wickets: 0, balls: 0, extras: { wide: 0, nb: 0, lb: 0, bye: 0 }, battingStats: [], bowlingStats: [], timeline: [] }
    },
    strikerId: null, nonStrikerId: null, currentBowlerId: null, isMatchOver: false, winner: null
};

function getActiveMatch() {
    return state.matches.find(m => m.id === state.activeMatchId);
}

function updateMatch(updatedMatch) {
    const index = state.matches.findIndex(m => m.id === updatedMatch.id);
    if (index !== -1) {
        state.matches[index] = updatedMatch;
        saveMatches();
        render();
    }
}

function formatOvers(balls) {
    return `${Math.floor((balls || 0) / 6)}.${(balls || 0) % 6}`;
}

// --- Render Logic ---
function render() {
    const app = document.getElementById('app');
    const headerActions = document.getElementById('header-actions');
    if (!app || !headerActions) return;

    app.innerHTML = '';
    headerActions.innerHTML = '';

    // Header Logic
    if (state.view === 'HOME') {
        headerActions.innerHTML = '';
    } else if (state.view === 'SCORER') {
        headerActions.innerHTML = `<button onclick="router('SUMMARY')" class="text-xs font-bold bg-premium-grey hover:bg-premium-dark text-white border border-premium-dark px-4 py-1.5 rounded-full transition-colors shadow-md">Scorecard</button>`;
    } else if (state.view === 'SUMMARY' && getActiveMatch() && !getActiveMatch().isMatchOver) {
        headerActions.innerHTML = `<button onclick="router('SCORER')" class="text-xs font-bold bg-premium-teal hover:bg-premium-dark text-white px-4 py-1.5 rounded-full transition-colors shadow-lg">Resume</button>`;
    }

    switch (state.view) {
        case 'HOME': renderHome(app); break;
        case 'NEW_MATCH': renderNewMatch(app); break;
        case 'TOSS': renderToss(app); break;
        case 'SCORER': renderScorer(app); break;
        case 'SUMMARY': renderSummary(app); break;
    }

    if (window.lucide) lucide.createIcons();
}

// --- View: Home ---
function renderHome(container) {
    const hasMatches = state.matches.length > 0;

    // Calculate Career Stats
    const totalMatches = state.matches.length;
    const finishedMatches = state.matches.filter(m => m.isMatchOver).length;
    const runsScored = state.matches.reduce((acc, m) => {
        const inn1 = m.innings[1].runs || 0;
        const inn2 = m.innings[2].runs || 0;
        return acc + inn1 + inn2;
    }, 0);

    const statsHtml = `
    <div class="grid grid-cols-3 gap-3 mb-6 fade-in">
        <div class="bg-white p-3 rounded-2xl border border-premium-100 shadow-sm text-center">
            <div class="text-xs font-bold text-premium-muted uppercase tracking-wider mb-1">Matches</div>
            <div class="text-xl font-black text-premium-deep">${totalMatches}</div>
        </div>
        <div class="bg-white p-3 rounded-2xl border border-premium-100 shadow-sm text-center">
            <div class="text-xs font-bold text-premium-muted uppercase tracking-wider mb-1">Finished</div>
            <div class="text-xl font-black text-premium-teal">${finishedMatches}</div>
        </div>
        <div class="bg-white p-3 rounded-2xl border border-premium-100 shadow-sm text-center">
            <div class="text-xs font-bold text-premium-muted uppercase tracking-wider mb-1">Runs</div>
            <div class="text-xl font-black text-premium-dark">${runsScored}</div>
        </div>
    </div>
`;

    let matchesHtml = '';
    if (!hasMatches) {
        matchesHtml = `<div class="text-center py-12 bg-white rounded-3xl border border-dashed border-premium-light"><p class="text-premium-muted">No matches recorded yet.</p></div>`;
    } else {
        matchesHtml = state.matches.map(match => `
        <div onclick="openMatch('${match.id}')" class="bg-white p-5 rounded-2xl shadow-sm border border-premium-100 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer relative group mb-4 overflow-hidden">
            <div class="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-premium-teal to-premium-dark opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-2 text-xs font-bold text-premium-grey bg-premium-50 px-2.5 py-1 rounded-full">
                    <i data-lucide="calendar" class="w-3 h-3"></i> ${match.date}
                </div>
                ${match.isMatchOver
                ? `<span class="text-[10px] font-black bg-premium-deep text-white px-2 py-1 rounded-md uppercase tracking-wider">Finished</span>`
                : `<span class="text-[10px] font-black bg-premium-teal/10 text-premium-teal px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-premium-teal animate-pulse"></span> Live</span>`
            }
            </div>
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-1">
                        <span class="font-bold text-lg text-premium-deep truncate max-w-[100px]">${match.teamA}</span>
                        <span class="text-premium-light text-sm font-bold">VS</span>
                        <span class="font-bold text-lg text-premium-deep truncate max-w-[100px]">${match.teamB}</span>
                    </div>
                    <div class="text-xs text-premium-muted flex items-center gap-1 font-medium">
                        <i data-lucide="target" class="w-3 h-3"></i> ${match.overs} Overs • ${match.tossWinner ? `${match.tossWinner} (${match.tossDecision})` : 'Toss Pending'}
                    </div>
                </div>
                <div class="text-premium-light group-hover:text-premium-teal transition-colors pl-4">
                    <i data-lucide="chevron-right" class="w-6 h-6"></i>
                </div>
            </div>
            <button onclick="event.stopPropagation(); deleteMatch('${match.id}')" class="absolute top-3 right-3 text-premium-light hover:text-red-500 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
    }

    container.innerHTML = `
    <div class="space-y-8 fade-in">
        <div class="bg-gradient-to-br from-premium-deep to-premium-dark p-8 rounded-3xl shadow-xl text-center relative overflow-hidden group">
            <div class="absolute top-0 right-0 w-64 h-64 bg-premium-teal/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div class="relative z-10">
                <div class="inline-block p-3 bg-premium-teal/20 rounded-full mb-4">
                    <i data-lucide="trophy" class="w-10 h-10 text-premium-light drop-shadow-md"></i>
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">Local Cricket Scorer</h2>
                <p class="text-premium-light text-sm mb-8 max-w-xs mx-auto">Premium grade scoring made simple.</p>
                <button onclick="router('NEW_MATCH')" class="w-full bg-gradient-to-r from-premium-teal to-premium-dark hover:brightness-110 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] shadow-lg shadow-black/20 border border-premium-teal/30">
                    <i data-lucide="plus-circle" class="w-5 h-5"></i> Start New Match
                </button>
            </div>
        </div>
        <div>
            <h3 class="text-lg font-bold text-premium-deep mb-4 flex items-center gap-2 px-1">
                <i data-lucide="history" class="text-premium-teal w-5 h-5"></i> Recent Matches
            </h3>
            ${statsHtml}
            ${matchesHtml}
        </div>
    </div>
`;
}

function deleteMatch(id) {
    if (confirm("Delete this match record?")) {
        state.matches = state.matches.filter(m => m.id !== id);
        saveMatches();
        render();
    }
}

function openMatch(id) {
    state.activeMatchId = id;
    const match = getActiveMatch();
    router(match.isMatchOver ? 'SUMMARY' : 'SCORER');
}

// --- View: New Match ---
function renderNewMatch(container) {
    container.innerHTML = `
    <div class="fade-in">
        <button onclick="router('HOME')" class="flex items-center text-premium-muted hover:text-premium-deep font-medium mb-6 transition-colors">
            <i data-lucide="chevron-left" class="w-5 h-5"></i> Back
        </button>
        <div class="bg-white rounded-3xl shadow-xl p-8 border border-premium-100">
            <div class="flex items-center gap-3 mb-8">
                <div class="bg-premium-50 p-3 rounded-xl text-premium-teal">
                    <i data-lucide="users" class="w-6 h-6"></i>
                </div>
                <h2 class="text-2xl font-bold text-premium-deep">Match Setup</h2>
            </div>
            <form id="newMatchForm" onsubmit="submitNewMatch(event)" class="space-y-6">
                <div class="grid grid-cols-1 gap-6">
                    <div class="relative">
                        <label class="absolute -top-2.5 left-4 bg-white px-2 text-xs font-bold text-premium-teal">TEAM 1</label>
                        <input required type="text" name="teamA" class="w-full border-2 border-premium-100 rounded-xl p-4 text-lg font-semibold focus:border-premium-teal outline-none transition-colors bg-premium-50 focus:bg-white text-premium-deep" placeholder="e.g. Super Kings">
                    </div>
                    <div class="flex items-center justify-center"><span class="bg-premium-50 text-premium-light rounded-full p-2 font-bold text-xs">VS</span></div>
                    <div class="relative">
                        <label class="absolute -top-2.5 left-4 bg-white px-2 text-xs font-bold text-premium-teal">TEAM 2</label>
                        <input required type="text" name="teamB" class="w-full border-2 border-premium-100 rounded-xl p-4 text-lg font-semibold focus:border-premium-teal outline-none transition-colors bg-premium-50 focus:bg-white text-premium-deep" placeholder="e.g. Royals">
                    </div>
                </div>
                <div class="pt-4">
                    <label class="block text-sm font-bold text-premium-grey mb-3 flex items-center gap-2">
                        <i data-lucide="target" class="w-4 h-4 text-premium-teal"></i> Match Overs: <span id="overVal" class="text-premium-teal font-mono">10</span>
                    </label>
                    <input type="range" name="overs" min="1" max="50" value="10" class="w-full h-2 bg-premium-100 rounded-lg appearance-none cursor-pointer accent-premium-teal" oninput="document.getElementById('overVal').innerText = this.value">
                </div>
                <button type="submit" class="w-full bg-premium-deep hover:bg-premium-dark text-white font-bold py-4 rounded-xl mt-6 flex items-center justify-center gap-2 shadow-xl shadow-premium-deep/20 transition-all transform hover:-translate-y-1">
                    Proceed to Toss <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </form>
        </div>
    </div>
`;
}

function submitNewMatch(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    state.pendingMatchSetup = {
        teamA: formData.get('teamA'),
        teamB: formData.get('teamB'),
        overs: formData.get('overs')
    };
    state.flipState = 'IDLE';
    state.tossWinner = null;
    router('TOSS');
}

// --- View: Toss ---
let tossInterval;
function renderToss(container) {
    const teams = state.pendingMatchSetup;
    let actionArea = '';

    if (state.flipState === 'IDLE') {
        actionArea = `
        <button onclick="startFlip()" class="bg-premium-deep text-white px-10 py-4 rounded-full font-bold text-lg shadow-xl shadow-premium-deep/30 hover:bg-premium-dark hover:scale-105 active:scale-95 transition-all flex items-center gap-3 mx-auto">
            <i data-lucide="coins" class="text-yellow-400 w-6 h-6"></i> Flip Coin
        </button>`;
    } else if (state.flipState === 'RESULT' && !state.tossWinner) {
        actionArea = `
        <div class="w-full max-w-xs mx-auto fade-in">
            <h3 class="text-premium-grey mb-4 font-semibold uppercase tracking-wider text-xs">Who won the toss?</h3>
            <div class="space-y-3">
                <button onclick="setTossWinner('${teams.teamA}')" class="w-full p-4 border-2 border-premium-100 rounded-xl font-bold text-premium-grey hover:border-premium-teal hover:bg-premium-50 hover:text-premium-teal transition-all text-lg">${teams.teamA}</button>
                <button onclick="setTossWinner('${teams.teamB}')" class="w-full p-4 border-2 border-premium-100 rounded-xl font-bold text-premium-grey hover:border-premium-teal hover:bg-premium-50 hover:text-premium-teal transition-all text-lg">${teams.teamB}</button>
            </div>
        </div>`;
    } else if (state.tossWinner) {
        actionArea = `
        <div class="w-full fade-in">
            <h3 class="text-premium-deep mb-6 font-bold text-xl"><span class="text-premium-teal border-b-2 border-premium-light pb-1">${state.tossWinner}</span> elected to:</h3>
            <div class="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                <button onclick="finalizeMatch('BAT')" class="bg-gradient-to-br from-premium-teal to-premium-dark text-white p-6 rounded-2xl font-bold hover:shadow-lg active:scale-95 transition-all flex flex-col items-center gap-2 border border-premium-teal/50">
                    <span class="text-2xl">🏏</span> <span>BAT</span>
                </button>
                <button onclick="finalizeMatch('BOWL')" class="bg-gradient-to-br from-premium-grey to-premium-muted text-white p-6 rounded-2xl font-bold hover:shadow-lg active:scale-95 transition-all flex flex-col items-center gap-2 border border-premium-grey/50">
                    <span class="text-2xl">⚾</span> <span>BOWL</span>
                </button>
            </div>
        </div>`;
    }

    container.innerHTML = `
    <div class="h-full flex flex-col fade-in">
        <button onclick="router('NEW_MATCH')" class="flex items-center text-premium-muted mb-6 w-fit"><i data-lucide="chevron-left" class="w-5 h-5"></i> Back</button>
        <div class="bg-white rounded-3xl shadow-xl border border-premium-100 p-8 flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-premium-teal via-premium-muted to-premium-teal"></div>
            <h2 class="text-3xl font-bold mb-12 text-premium-deep">The Toss</h2>
            <div class="mb-16 relative perspective-1000">
                <div class="w-40 h-40 rounded-full border-8 border-premium-light/30 flex items-center justify-center bg-gradient-to-br from-yellow-100 via-white to-yellow-100 shadow-2xl shadow-black/10 transition-transform duration-100 transform-style-3d ${state.flipState === 'FLIPPING' ? 'coin-flip' : ''}">
                    <div class="w-32 h-32 rounded-full border-2 border-premium-light/20 flex items-center justify-center">
                        <span class="text-5xl font-black text-premium-grey/50 drop-shadow-sm">${state.flipState === 'FLIPPING' ? '?' : (state.coinSide === 'HEADS' ? 'H' : 'T')}</span>
                    </div>
                </div>
                ${state.flipState === 'RESULT' ? `<div class="absolute -bottom-10 left-1/2 -translate-x-1/2 w-48"><div class="text-xl font-bold text-premium-deep animate-bounce bg-yellow-100 px-4 py-1 rounded-full border border-yellow-200">It's ${state.coinSide}!</div></div>` : ''}
            </div>
            ${actionArea}
        </div>
    </div>
`;
}

function startFlip() {
    state.flipState = 'FLIPPING';
    render();
    let flips = 0;
    tossInterval = setInterval(() => {
        state.coinSide = state.coinSide === 'HEADS' ? 'TAILS' : 'HEADS';
        flips++;
        if (flips > 15) {
            clearInterval(tossInterval);
            state.coinSide = Math.random() > 0.5 ? 'HEADS' : 'TAILS';
            state.flipState = 'RESULT';
            render();
        }
    }, 100);
}

function setTossWinner(team) {
    state.tossWinner = team;
    render();
}

function finalizeMatch(decision) {
    const setup = state.pendingMatchSetup;
    const winner = state.tossWinner;

    let battingFirst = decision === 'BAT' ? winner : (winner === setup.teamA ? setup.teamB : setup.teamA);
    let bowlingFirst = decision === 'BAT' ? (winner === setup.teamA ? setup.teamB : setup.teamA) : winner;

    const newMatch = {
        ...initialMatchState,
        id: generateId(),
        date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        teamA: setup.teamA,
        teamB: setup.teamB,
        tossWinner: winner,
        tossDecision: decision,
        overs: parseInt(setup.overs),
        innings: {
            1: { ...initialMatchState.innings[1], battingTeam: battingFirst, bowlingTeam: bowlingFirst, timeline: [] },
            2: { ...initialMatchState.innings[2], battingTeam: bowlingFirst, bowlingTeam: battingFirst, timeline: [] }
        }
    };

    state.matches.unshift(newMatch);
    state.activeMatchId = newMatch.id;
    saveMatches();
    router('SCORER');
}

// --- View: Scorer ---
function renderScorer(container) {
    const match = getActiveMatch();
    if (!match) return;
    const currentData = match.innings[match.currentInnings];

    const getPlayer = (id, type) => {
        const list = type === 'bat' ? currentData.battingStats : currentData.bowlingStats;
        return list.find(p => p.id === id);
    };

    const striker = getPlayer(match.strikerId, 'bat');
    const nonStriker = getPlayer(match.nonStrikerId, 'bat');
    const bowler = getPlayer(match.currentBowlerId, 'bowl');

    const modalHtml = state.showPlayerModal ? `
    <div class="fixed inset-0 bg-premium-deep/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
        <div class="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-premium-light">
            <h3 class="text-xl font-bold mb-2 text-premium-deep">Select ${state.playerModalType === 'BOWLER' ? 'Next Bowler' : 'New Batsman'}</h3>
            <input id="playerNameInput" type="text" class="w-full border-2 border-premium-100 bg-premium-50 p-4 rounded-xl mb-4 font-semibold focus:border-premium-teal outline-none text-premium-deep" placeholder="Enter Name" autofocus>
            <button onclick="addPlayer()" class="w-full bg-premium-teal text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-premium-dark transition-colors">Confirm</button>
        </div>
    </div>` : '';

    const heroHtml = `
    <div class="bg-gradient-to-br from-premium-deep to-premium-dark text-white p-6 rounded-b-3xl shadow-xl relative overflow-hidden mb-4 border-b border-premium-teal/30">
        <div class="absolute top-0 right-0 w-64 h-64 bg-premium-teal/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div class="relative z-10 flex justify-between items-start">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-bold bg-premium-teal/20 text-premium-light px-2 py-0.5 rounded border border-premium-teal/30">${currentData.battingTeam}</span>
                    ${match.currentInnings === 2 ? `<span class="text-xs text-premium-light">Target: ${match.innings[1].runs + 1}</span>` : ''}
                </div>
                <div class="text-6xl font-black tracking-tighter leading-none">${currentData.runs}<span class="text-premium-muted text-4xl">/${currentData.wickets}</span></div>
            </div>
            <div class="text-right">
                <div class="text-xs text-premium-light font-bold uppercase tracking-widest mb-1">OVERS</div>
                <div class="text-3xl font-mono font-bold text-premium-light">${formatOvers(currentData.balls)}<span class="text-premium-muted text-lg">/${match.overs}</span></div>
            </div>
        </div>
    </div>`;

    let mainAreaHtml = '';

    if (match.isMatchOver) {
        mainAreaHtml = `
        <div class="mx-4 mb-4 bg-gradient-to-r from-premium-50 to-white border border-premium-100 p-6 rounded-2xl text-center shadow-sm">
            <i data-lucide="trophy" class="mx-auto text-yellow-500 w-10 h-10 mb-2"></i>
            <h3 class="font-black text-2xl text-premium-deep mb-1">Match Finished</h3>
            <p class="text-premium-teal font-bold mb-4">${match.winner}</p>
            <button onclick="router('SUMMARY')" class="bg-premium-deep text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg">View Full Scorecard</button>
        </div>`;
    } else if (match.currentInnings === 1 && (currentData.wickets === 10 || (Math.floor(currentData.balls / 6) === match.overs && currentData.balls % 6 === 0))) {
        mainAreaHtml = `
        <div class="mx-4 mb-4 bg-premium-50 border border-premium-100 p-6 rounded-2xl text-center">
            <h3 class="font-bold text-lg text-premium-dark">Innings Break</h3>
            <p class="text-premium-grey mb-4">Target set: <span class="font-bold">${currentData.runs + 1}</span></p>
            <button onclick="startNextInnings()" class="bg-premium-teal text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 w-full"><i data-lucide="play-circle" class="w-5 h-5"></i> Start 2nd Innings</button>
        </div>`;
    } else {
        mainAreaHtml = `
        <div class="grid grid-cols-1 gap-3 px-4 mb-4">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-premium-100">
                <div class="flex justify-between items-center mb-3 pb-2 border-b border-premium-50">
                    <span class="text-xs font-bold text-premium-muted uppercase tracking-wider">Batting</span>
                    <button onclick="swapEnds()" class="text-xs font-bold text-premium-teal flex items-center gap-1 bg-premium-50 px-2 py-1 rounded-md"><i data-lucide="arrow-right-left" class="w-3 h-3"></i> Swap</button>
                </div>
                <div onclick="promptPlayer('STRIKER')" class="flex justify-between items-center mb-3 cursor-pointer p-2 rounded-xl transition-colors ${match.strikerId ? 'bg-premium-50' : 'bg-premium-50 border border-dashed border-premium-light'}">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full bg-premium-teal shadow-lg shadow-premium-teal/50"></div>
                        <div>
                            <div class="font-bold text-premium-deep ${!striker ? 'text-premium-muted italic' : ''}">${striker ? striker.name : 'Select Striker'}</div>
                            <div class="text-xs text-premium-grey">${striker ? `${striker.fours}x4 ${striker.sixes}x6` : 'Tap to add'}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold text-premium-deep">${striker ? striker.runs : 0}</div>
                        <div class="text-xs text-premium-grey">${striker ? striker.balls : 0} balls</div>
                    </div>
                </div>
                <div onclick="promptPlayer('NON_STRIKER')" class="flex justify-between items-center cursor-pointer p-2 rounded-xl ${match.nonStrikerId ? '' : 'bg-premium-50 border border-dashed border-premium-light'}">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full bg-premium-light"></div>
                        <div class="font-medium text-premium-grey ${!nonStriker ? 'italic' : ''}">${nonStriker ? nonStriker.name : 'Select Non-Striker'}</div>
                    </div>
                    <div class="text-right"><div class="text-lg font-bold text-premium-muted">${nonStriker ? nonStriker.runs : 0}</div></div>
                </div>
            </div>
            <div onclick="promptPlayer('BOWLER')" class="bg-white p-4 rounded-2xl shadow-sm border border-premium-100 cursor-pointer hover:bg-premium-50">
                <div class="flex justify-between items-center">
                    <div>
                        <span class="text-xs font-bold text-premium-muted uppercase tracking-wider block mb-1">Bowling</span>
                        <div class="font-bold text-lg text-premium-deep ${!bowler ? 'text-premium-muted italic' : ''}">${bowler ? bowler.name : 'Select Bowler'}</div>
                    </div>
                    ${bowler ? `<div class="text-right"><div class="text-xl font-bold text-premium-deep">${bowler.wickets}<span class="text-premium-grey text-sm">-${bowler.runs}</span></div><div class="text-xs text-premium-grey">${formatOvers(bowler.balls || 0)} overs</div></div>` : ''}
                </div>
            </div>
        </div>
        
        <div class="px-4">
            <div class="grid grid-cols-4 gap-3 mb-3">
                ${[0, 1, 2, 3, 4, 6].map(r => {
            const cls = r === 4 ? 'bg-blue-50 text-blue-700 border border-blue-100' : r === 6 ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-white text-premium-deep border border-premium-100 hover:bg-premium-50';
            return `<button onclick="score(${r})" class="h-16 rounded-2xl font-bold text-2xl shadow-sm active:scale-95 transition-all ${cls}">${r}</button>`;
        }).join('')}
                <button onclick="undo()" class="col-span-2 h-16 bg-premium-50 text-premium-grey rounded-2xl flex flex-col items-center justify-center active:scale-95 border border-premium-100 hover:bg-premium-100"><i data-lucide="rotate-ccw" class="w-5 h-5"></i><span class="text-[10px] font-bold mt-1 uppercase">Undo</span></button>
            </div>
            <div class="grid grid-cols-5 gap-2">
                <button onclick="score(1, true, false, false, false, false)" class="h-12 bg-premium-50 text-premium-teal font-bold rounded-xl text-xs border border-premium-100 hover:bg-premium-100">WD</button>
                <button onclick="score(1, false, true, false, false, false)" class="h-12 bg-premium-50 text-premium-teal font-bold rounded-xl text-xs border border-premium-100 hover:bg-premium-100">NB</button>
                <button onclick="score(1, false, false, false, true, false)" class="h-12 bg-white text-premium-grey font-bold rounded-xl text-xs border border-premium-100 hover:bg-premium-50">Bye</button>
                <button onclick="score(1, false, false, false, false, true)" class="h-12 bg-white text-premium-grey font-bold rounded-xl text-xs border border-premium-100 hover:bg-premium-50">LB</button>
                <button onclick="score(0, false, false, true, false, false)" class="h-12 bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-500/30 hover:bg-red-600">OUT</button>
            </div>
        </div>`;
    }

    container.innerHTML = `<div>${modalHtml}${heroHtml}${mainAreaHtml}</div>`;

    if (state.showPlayerModal) document.getElementById('playerNameInput').focus();
}

// Scorer Logic
function promptPlayer(type) {
    if (type === 'STRIKER' && getActiveMatch().strikerId) return;
    state.playerModalType = type;
    state.showPlayerModal = true;
    render();
}

function addPlayer() {
    const name = document.getElementById('playerNameInput').value.trim();
    if (!name) return;
    const match = getActiveMatch();
    const data = match.innings[match.currentInnings];
    if (state.playerModalType === 'BOWLER') {
        const existing = data.bowlingStats.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (existing) match.currentBowlerId = existing.id;
        else {
            const newId = generateId();
            data.bowlingStats.push({ id: newId, name: name, overs: 0, runs: 0, wickets: 0, maidens: 0, balls: 0 });
            match.currentBowlerId = newId;
        }
    } else {
        const newId = generateId();
        data.battingStats.push({ id: newId, name: name, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false });
        if (state.playerModalType === 'STRIKER') match.strikerId = newId;
        if (state.playerModalType === 'NON_STRIKER') match.nonStrikerId = newId;
    }
    state.showPlayerModal = false;
    state.playerNameInput = '';
    updateMatch(match);
}

function swapEnds() {
    const match = getActiveMatch();
    const temp = match.strikerId;
    match.strikerId = match.nonStrikerId;
    match.nonStrikerId = temp;
    updateMatch(match);
}

function startNextInnings() {
    const match = getActiveMatch();
    match.currentInnings = 2;
    match.strikerId = null;
    match.nonStrikerId = null;
    match.currentBowlerId = null;
    updateMatch(match);
}

function score(runs, isWide = false, isNoBall = false, isWicket = false, isBye = false, isLegBye = false) {
    const match = getActiveMatch();
    if (!match.strikerId || !match.nonStrikerId) { promptPlayer(!match.strikerId ? 'STRIKER' : 'NON_STRIKER'); return; }
    if (!match.currentBowlerId) { promptPlayer('BOWLER'); return; }

    const matchCopy = JSON.parse(JSON.stringify(match));
    matchCopy.innings[1].timeline = []; matchCopy.innings[2].timeline = [];
    const data = match.innings[match.currentInnings];
    if (!data.timeline) data.timeline = [];
    data.timeline.push(matchCopy);

    let totalRuns = runs + (isWide || isNoBall ? 1 : 0);
    data.runs += totalRuns;
    const isLegal = !isWide && !isNoBall;
    if (isLegal) data.balls++;

    if (isWide) data.extras.wide += (1 + runs);
    if (isNoBall) data.extras.nb += (1 + runs);
    if (isBye) data.extras.bye += runs;
    if (isLegBye) data.extras.lb += runs;

    const striker = data.battingStats.find(p => p.id === match.strikerId);
    if (striker) {
        if (!isWide) striker.balls++;
        const batRuns = (isWide || isBye || isLegBye) ? 0 : runs;
        striker.runs += batRuns;
        if (batRuns === 4) {
            striker.fours++;
            pulseElement('app');
        }
        if (batRuns === 6) {
            striker.sixes++;
            pulseElement('app');
        }
    }

    const bowler = data.bowlingStats.find(p => p.id === match.currentBowlerId);
    if (bowler) {
        const bowlRuns = (isBye || isLegBye) ? 0 : totalRuns;
        bowler.runs += bowlRuns;
        if (isLegal) bowler.balls++;
    }

    if (isWicket) {
        data.wickets++;
        shakeElement('app');
        if (!isMatchOverCheck(match, data)) {
            bowler.wickets++;
            striker.isOut = true;
            match.strikerId = null;
        }
    }

    if (runs % 2 !== 0) swapEndsInternal(match);
    if (isLegal && data.balls % 6 === 0) {
        match.currentBowlerId = null;
        swapEndsInternal(match);
    }

    checkMatchEnd(match);
    updateMatch(match);
}

function swapEndsInternal(match) {
    const temp = match.strikerId;
    match.strikerId = match.nonStrikerId;
    match.nonStrikerId = temp;
}

function checkMatchEnd(match) {
    const data = match.innings[match.currentInnings];
    if (isMatchOverCheck(match, data)) {
        if (match.currentInnings === 2) {
            const t1 = match.innings[1].runs;
            const t2 = data.runs;
            if (t2 > t1) match.winner = `${match.teamB} won`;
            else if (t2 === t1) match.winner = "Match Tied";
            else match.winner = `${match.teamA} won`;
            match.isMatchOver = true;
            triggerConfetti();
        }
    }
}

function isMatchOverCheck(match, data) {
    if (data.wickets >= 10) return true;
    if (Math.floor(data.balls / 6) >= match.overs) return true;
    if (match.currentInnings === 2 && data.runs > match.innings[1].runs) return true;
    return false;
}

function undo() {
    const match = getActiveMatch();
    const data = match.innings[match.currentInnings];
    if (!data.timeline || data.timeline.length === 0) return;
    const prev = data.timeline.pop();
    const currentTimeline = data.timeline;
    Object.assign(match, prev);
    match.innings[match.currentInnings].timeline = currentTimeline;
    updateMatch(match);
}

// --- View: Summary ---

function renderSummary(container) {
    const match = getActiveMatch();
    const inn1 = match.innings[1];
    const inn2 = match.innings[2];

    const renderTable = (innData) => {
        if (!innData.balls && !innData.runs) return '<div class="p-4 text-center text-premium-muted">Innings not started</div>';
        return `
        <div class="space-y-4">
            <div class="bg-white p-4 rounded-2xl shadow-sm text-center border border-premium-100">
                <div class="text-3xl font-black text-premium-deep">${innData.runs}/${innData.wickets}</div>
                <div class="text-sm text-premium-grey">${formatOvers(innData.balls)} Overs</div>
            </div>
            <div class="bg-white rounded-2xl border border-premium-100 overflow-hidden shadow-sm">
                <div class="bg-premium-50 px-4 py-2 text-xs font-bold text-premium-grey">Batting</div>
                <table class="w-full text-sm text-left">
                    <tbody class="divide-y divide-premium-50">
                        ${innData.battingStats.map(p => `<tr><td class="p-3 font-bold text-premium-deep">${p.name}</td><td class="p-3 text-right font-bold text-premium-deep">${p.runs}</td><td class="p-3 text-right text-xs text-premium-grey">${p.balls}b</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="bg-white rounded-2xl border border-premium-100 overflow-hidden shadow-sm">
                <div class="bg-premium-50 px-4 py-2 text-xs font-bold text-premium-grey">Bowling</div>
                <table class="w-full text-sm text-left">
                    <tbody class="divide-y divide-premium-50">
                        ${innData.bowlingStats.map(p => `<tr><td class="p-3 font-bold text-premium-deep">${p.name}</td><td class="p-3 text-right text-xs text-premium-grey">${formatOvers(p.balls)}</td><td class="p-3 text-right text-xs text-premium-grey">${p.runs}R</td><td class="p-3 text-right font-bold text-premium-teal">${p.wickets}W</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    };

    container.innerHTML = `
    <div class="fade-in pb-10">
        <div class="flex items-center gap-2 p-4 mb-2">
            <button onclick="router('HOME')" class="p-2 hover:bg-premium-100 rounded-full transition-colors"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
            <h2 class="font-bold text-xl text-premium-deep">Match Summary</h2>
        </div>
        <div class="text-center mb-6">
            <h2 class="text-2xl font-black text-premium-deep">${match.winner || 'In Progress'}</h2>
            
            <!-- Removed AI Report Buttons -->
        </div>

        <div class="px-4">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-premium-100 mb-6">
                <h3 class="text-xs font-bold text-premium-muted uppercase tracking-wider mb-3">Run Worm</h3>
                <canvas id="runWormChart" height="200"></canvas>
            </div>

            <div class="flex bg-premium-100 p-1 rounded-xl mb-4">
                <button onclick="document.getElementById('inn1').classList.remove('hidden'); document.getElementById('inn2').classList.add('hidden');" class="flex-1 py-2 rounded-lg font-bold text-sm bg-white text-premium-teal shadow-sm focus:bg-white focus:shadow-sm hover:text-premium-dark">${match.teamA}</button>
                <button onclick="document.getElementById('inn2').classList.remove('hidden'); document.getElementById('inn1').classList.add('hidden');" class="flex-1 py-2 rounded-lg font-bold text-sm text-premium-grey hover:text-premium-deep focus:bg-white focus:text-premium-teal focus:shadow-sm">${match.teamB}</button>
            </div>
            <div id="inn1">${renderTable(inn1)}</div>
            <div id="inn2" class="hidden">${renderTable(inn2)}</div>
        </div>
    </div>`;

    setTimeout(() => renderRunWorm(match), 100);
}

function renderRunWorm(match) {
    const ctx = document.getElementById('runWormChart');
    if (!ctx) return;

    const extractRuns = (innIndex) => {
        const timeline = match.innings[innIndex].timeline || [];
        return timeline.map(t => t.innings[innIndex].runs);
    };

    const data1 = extractRuns(1);
    const data2 = extractRuns(2);

    const labels = Array.from({ length: Math.max(data1.length, data2.length) }, (_, i) => i + 1);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: match.teamA,
                    data: data1,
                    borderColor: '#2D4A53', // premium-teal
                    backgroundColor: 'rgba(45, 74, 83, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: match.teamB,
                    data: data2,
                    borderColor: '#69818D', // premium-muted
                    backgroundColor: 'rgba(105, 129, 141, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: false }
            },
            scales: {
                x: { display: false },
                y: { beginAtZero: true }
            },
            elements: {
                point: { radius: 0 }
            }
        }
    });
}