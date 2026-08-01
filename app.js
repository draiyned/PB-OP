(function () {
  "use strict";

  /* ---------- palette (kept for the SVG logo colors) ---------- */
  var BALL_COLOR = "#E8D144";
  var LINE_COLOR = "#F5EFD9";
  var COURT_COLOR = "#2F6E5C";

  /* ---------- state ---------- */
  var state = {
    players: [],
    numCourts: 2,
    sessionStarted: false,
    courts: [],
    matchCounts: [],
    gamesPlayed: {},
    benchOrder: {},
    turnCounter: 0,
    partnerHistory: {},
    history: [],
    error: "",
    confirmState: {},
    confirmEndSession: false,
    scoreDraft: {},
    nameInput: "",
  };

  /* ---------- toast notification ---------- */
  var toastRoot = null;
  var toastTimer = null;

  function showToast(message, iconFn) {
    if (!toastRoot) return;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = (iconFn ? iconFn(14) : "") + "<span>" + escapeHtml(message) + "</span>";
    toastRoot.innerHTML = "";
    toastRoot.appendChild(el);
    // force reflow so the transition to toast-visible actually animates
    void el.offsetWidth;
    el.classList.add("toast-visible");
    toastTimer = setTimeout(function () {
      el.classList.remove("toast-visible");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 200);
    }, 2600);
  }

  /* ---------- helpers ---------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function pairKey(a, b) {
    return [a, b].sort().join("::");
  }

  function bestTeamSplit(four, partnerHistory) {
    var p0 = four[0], p1 = four[1], p2 = four[2], p3 = four[3];
    var options = shuffle([
      { teamA: [p0, p1], teamB: [p2, p3] },
      { teamA: [p0, p2], teamB: [p1, p3] },
      { teamA: [p0, p3], teamB: [p1, p2] },
    ]);
    var best = options[0];
    var bestScore = Infinity;
    options.forEach(function (opt) {
      var k1 = pairKey(opt.teamA[0].id, opt.teamA[1].id);
      var k2 = pairKey(opt.teamB[0].id, opt.teamB[1].id);
      var s = (partnerHistory[k1] || 0) + (partnerHistory[k2] || 0);
      if (s < bestScore) {
        bestScore = s;
        best = opt;
      }
    });
    // randomize which side of the winning split is "Team A" vs "Team B"
    return Math.random() < 0.5 ? best : { teamA: best.teamB, teamB: best.teamA };
  }

  function occupiedIds(courtsArr) {
    var s = {};
    courtsArr.forEach(function (c) {
      if (!c) return;
      c.teamA.concat(c.teamB).forEach(function (p) {
        s[p.id] = true;
      });
    });
    return s;
  }

  function pickFour(waitingPool, gp, bo) {
    var sorted = shuffle(waitingPool).sort(function (a, b) {
      var diff = (gp[a.id] || 0) - (gp[b.id] || 0);
      if (diff !== 0) return diff;
      return (bo[a.id] || 0) - (bo[b.id] || 0);
    });
    return sorted.slice(0, 4);
  }

  /* ---------- actions ---------- */
  function addPlayer() {
    var name = (state.nameInput || "").trim();
    if (!name) return;
    var exists = state.players.some(function (p) {
      return p.name.toLowerCase() === name.toLowerCase();
    });
    if (exists) {
      state.error = "That player's already on the list.";
      render();
      return;
    }
    var id = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    state.players.push({ id: id, name: name });
    state.gamesPlayed[id] = 0;
    state.benchOrder[id] = -1;
    state.nameInput = "";
    state.error = "";
    render();
  }

  function removePlayer(id) {
    state.players = state.players.filter(function (p) {
      return p.id !== id;
    });
    render();
  }

  function startSession() {
    if (state.players.length < 4) {
      state.error = "Need at least 4 players.";
      render();
      return;
    }
    state.error = "";

    var gp = Object.assign({}, state.gamesPlayed);
    var bo = Object.assign({}, state.benchOrder);
    var ph = Object.assign({}, state.partnerHistory);

    var waiting = state.players.slice();
    var newCourts = [];
    var newMatchCounts = [];

    for (var i = 0; i < state.numCourts; i++) {
      if (waiting.length < 4) {
        newCourts.push(null);
        newMatchCounts.push(0);
        continue;
      }
      var four = pickFour(waiting, gp, bo);
      var split = bestTeamSplit(four, ph);
      four.forEach(function (p) {
        gp[p.id] = (gp[p.id] || 0) + 1;
      });
      var kA = pairKey(split.teamA[0].id, split.teamA[1].id);
      var kB = pairKey(split.teamB[0].id, split.teamB[1].id);
      ph[kA] = (ph[kA] || 0) + 1;
      ph[kB] = (ph[kB] || 0) + 1;
      var fourIds = four.map(function (f) { return f.id; });
      waiting = waiting.filter(function (p) {
        return fourIds.indexOf(p.id) === -1;
      });
      newCourts.push({ teamA: split.teamA, teamB: split.teamB });
      newMatchCounts.push(1);
    }

    state.gamesPlayed = gp;
    state.partnerHistory = ph;
    state.courts = newCourts;
    state.matchCounts = newMatchCounts;
    state.history = [];
    state.sessionStarted = true;
    render();
    showToast("Session started", ICONS.check);
  }

  function askFinishCourt(ci) {
    state.confirmState[ci] = "confirmFinish";
    render();
  }

  function cancelFinishCourt(ci) {
    delete state.confirmState[ci];
    delete state.scoreDraft[ci];
    state.error = "";
    render();
  }

  function proceedToScore(ci) {
    state.scoreDraft[ci] = { a: "", b: "" };
    state.confirmState[ci] = "recordScore";
    render();
  }

  function saveScoreAndFinish(ci) {
    var finished = state.courts[ci];
    if (!finished) return;
    var draft = state.scoreDraft[ci] || { a: "", b: "" };
    var scoreA = parseInt(draft.a, 10);
    var scoreB = parseInt(draft.b, 10);
    if (isNaN(scoreA) || isNaN(scoreB)) {
      state.error = "Enter a score for both teams.";
      render();
      return;
    }
    if (scoreA === scoreB) {
      state.error = "Scores can't be tied — pick a winner.";
      render();
      return;
    }

    var counter = state.turnCounter;
    finished.teamA.concat(finished.teamB).forEach(function (p) {
      state.benchOrder[p.id] = counter;
    });
    counter += 1;

    state.history.unshift({
      court: ci,
      matchNum: state.matchCounts[ci],
      teamA: finished.teamA,
      teamB: finished.teamB,
      scoreA: scoreA,
      scoreB: scoreB,
      winner: scoreA > scoreB ? "A" : "B",
    });

    state.courts[ci] = null;
    state.turnCounter = counter;
    state.error = "";
    delete state.scoreDraft[ci];
    state.confirmState[ci] = "confirmNext";
    render();
  }

  function generateNextForCourt(ci) {
    var occupied = occupiedIds(state.courts);
    var waiting = state.players.filter(function (p) {
      return !occupied[p.id];
    });

    if (waiting.length < 4) {
      state.error =
        "Court " + (ci + 1) + " is waiting on players — only " + waiting.length + " free right now.";
      render();
      return;
    }

    var gp = Object.assign({}, state.gamesPlayed);
    var ph = Object.assign({}, state.partnerHistory);

    var four = pickFour(waiting, gp, state.benchOrder);
    var split = bestTeamSplit(four, ph);
    four.forEach(function (p) {
      gp[p.id] = (gp[p.id] || 0) + 1;
    });
    var kA = pairKey(split.teamA[0].id, split.teamA[1].id);
    var kB = pairKey(split.teamB[0].id, split.teamB[1].id);
    ph[kA] = (ph[kA] || 0) + 1;
    ph[kB] = (ph[kB] || 0) + 1;

    state.courts[ci] = { teamA: split.teamA, teamB: split.teamB };
    state.matchCounts[ci] = (state.matchCounts[ci] || 0) + 1;
    state.gamesPlayed = gp;
    state.partnerHistory = ph;
    state.error = "";
    delete state.confirmState[ci];
    render();
  }

  function askEndSession() {
    state.confirmEndSession = true;
    render();
  }

  function cancelEndSession() {
    state.confirmEndSession = false;
    render();
  }

  function resetAll() {
    state.sessionStarted = false;
    state.courts = [];
    state.matchCounts = [];
    state.history = [];
    var gp = {}, bo = {};
    state.players.forEach(function (p) {
      gp[p.id] = 0;
      bo[p.id] = -1;
    });
    state.gamesPlayed = gp;
    state.benchOrder = bo;
    state.turnCounter = 0;
    state.partnerHistory = {};
    state.error = "";
    state.confirmState = {};
    state.confirmEndSession = false;
    state.scoreDraft = {};
    render();
  }

  /* ---------- icons (inline SVG strings) ---------- */
  function icon(inner, size, extraStyle) {
    size = size || 16;
    return (
      '<svg class="icon" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" style="' + (extraStyle || "") + '">' +
      inner + "</svg>"
    );
  }
  var ICONS = {
    plus: function (size, style) {
      return icon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', size, style);
    },
    x: function (size, style) {
      return icon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', size, style);
    },
    shuffle: function (size, style) {
      return icon(
        '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>' +
        '<polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
        size, style
      );
    },
    rotateCcw: function (size, style) {
      return icon(
        '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
        size, style
      );
    },
    users: function (size, style) {
      return icon(
        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
        '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        size, style
      );
    },
    check: function (size, style) {
      return icon('<polyline points="20 6 9 17 4 12"/>', size, style);
    },
    clock: function (size, style) {
      return icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', size, style);
    },
    trophy: function (size, style) {
      return icon(
        '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>' +
        '<path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>' +
        '<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
        size, style
      );
    },
    download: function (size, style) {
      return icon(
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
        '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
        size, style
      );
    },
  };

  /* ---------- rendering ---------- */
  function teamNames(team) {
    return team.map(function (p) { return escapeHtml(p.name); }).join(" &amp; ");
  }

  function buildHeader() {
    return (
      '<div class="app-header">' +
        '<svg width="56" height="56" viewBox="0 0 56 56" style="flex-shrink:0">' +
          '<rect x="2" y="2" width="52" height="52" rx="4" fill="' + COURT_COLOR + '" stroke="' + LINE_COLOR + '" stroke-width="2"/>' +
          '<line x1="28" y1="2" x2="28" y2="54" stroke="' + LINE_COLOR + '" stroke-width="2"/>' +
          '<line x1="14" y1="2" x2="14" y2="54" stroke="' + LINE_COLOR + '" stroke-width="1.4" opacity="0.7"/>' +
          '<line x1="42" y1="2" x2="42" y2="54" stroke="' + LINE_COLOR + '" stroke-width="1.4" opacity="0.7"/>' +
          '<circle cx="28" cy="28" r="4" fill="' + BALL_COLOR + '"/>' +
        '</svg>' +
        '<div>' +
          '<h1 class="app-title">Open Play Generator</h1>' +
          '<p class="app-subtitle">Each court runs on its own clock — mark a court finished and it refills instantly.</p>' +
        '</div>' +
      '</div>'
    );
  }

  function buildSetupPanel(occupied) {
    var chips = state.players.map(function (p) {
      var occCls = occupied[p.id] ? " occupied" : "";
      return (
        '<span class="chip' + occCls + '">' +
          escapeHtml(p.name) +
          '<button type="button" class="chip-remove" data-action="remove-player" data-id="' + p.id + '" aria-label="Remove ' + escapeHtml(p.name) + '">' +
            ICONS.x(12) +
          '</button>' +
        '</span>'
      );
    }).join("");

    return (
      '<div class="panel">' +
        '<div class="panel-label-row">' +
          ICONS.users(16, "color:" + BALL_COLOR) +
          '<span class="label-caps">Players (' + state.players.length + ')</span>' +
        '</div>' +
        '<div class="add-player-row">' +
          '<input id="name-input" class="text-input" placeholder="Add a player name" value="' + escapeHtml(state.nameInput) + '" />' +
          '<button type="button" class="btn-add" data-action="add-player">' + ICONS.plus(16) + ' Add</button>' +
        '</div>' +
        (state.players.length > 0 ? '<div class="player-chips">' + chips + '</div>' : "") +
        '<label class="courts-label">Courts' +
          '<input id="num-courts-input" type="number" min="1" max="20" value="' + state.numCourts + '" class="number-input"' + (state.sessionStarted ? " disabled" : "") + ' />' +
        '</label>' +
      '</div>'
    );
  }

  function buildErrorBanner() {
    if (!state.error) return "";
    return '<div class="error-banner">' + escapeHtml(state.error) + '</div>';
  }

  function buildActionsRow() {
    if (!state.sessionStarted) {
      return (
        '<div class="actions-row">' +
          '<button type="button" class="btn-primary" data-action="start-session">' + ICONS.shuffle(16) + ' Start Session</button>' +
        '</div>'
      );
    }
    if (state.confirmEndSession) {
      return (
        '<div class="actions-row confirm-block" style="width:100%">' +
          '<div class="confirm-text">End this session? Courts and match history will be cleared.</div>' +
          '<div class="btn-row">' +
            '<button type="button" class="btn-small" data-action="reset-all">' + ICONS.check(13) + ' Yes, end session</button>' +
            '<button type="button" class="btn-ghost-small" data-action="cancel-end-session">Cancel</button>' +
          '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="actions-row">' +
        '<button type="button" class="btn-secondary" data-action="ask-end-session">' + ICONS.rotateCcw(14) + ' End session</button>' +
      '</div>'
    );
  }

  function buildCourtCard(court, ci) {
    var activeCls = court ? " active" : "";
    var inner = "";

    if (court) {
      inner += '<div class="net-line"></div>';
      inner += (
        '<div class="court-head">' +
          '<span class="court-label">Court ' + (ci + 1) + '</span>' +
          '<span class="match-num">match ' + state.matchCounts[ci] + '</span>' +
        '</div>' +
        '<div class="team-name">' + teamNames(court.teamA) + '</div>' +
        '<div class="vs">vs</div>' +
        '<div class="team-name">' + teamNames(court.teamB) + '</div>'
      );

      var cs = state.confirmState[ci];
      if (cs === "confirmFinish") {
        inner += (
          '<div class="confirm-block">' +
            '<div class="confirm-text">Mark this match finished?</div>' +
            '<div class="btn-row">' +
              '<button type="button" class="btn-small" data-action="proceed-score" data-ci="' + ci + '">' + ICONS.check(13) + ' Yes, finished</button>' +
              '<button type="button" class="btn-ghost-small" data-action="cancel-finish" data-ci="' + ci + '">Cancel</button>' +
            '</div>' +
          '</div>'
        );
      } else if (cs === "recordScore") {
        var draft = state.scoreDraft[ci] || { a: "", b: "" };
        inner += (
          '<div class="confirm-block">' +
            '<div class="confirm-text">What was the score?</div>' +
            '<div class="score-row">' +
              '<label class="score-label"><span class="score-team-name">' + teamNames(court.teamA) + '</span>' +
                '<input type="number" min="0" class="score-input" data-bind="score" data-ci="' + ci + '" data-team="a" value="' + escapeHtml(draft.a) + '" />' +
              '</label>' +
            '</div>' +
            '<div class="score-row last">' +
              '<label class="score-label"><span class="score-team-name">' + teamNames(court.teamB) + '</span>' +
                '<input type="number" min="0" class="score-input" data-bind="score" data-ci="' + ci + '" data-team="b" value="' + escapeHtml(draft.b) + '" />' +
              '</label>' +
            '</div>' +
            '<div class="btn-row">' +
              '<button type="button" class="btn-small" data-action="save-score" data-ci="' + ci + '">' + ICONS.check(13) + ' Save match</button>' +
              '<button type="button" class="btn-ghost-small" data-action="cancel-finish" data-ci="' + ci + '">Cancel</button>' +
            '</div>' +
          '</div>'
        );
      } else {
        inner += (
          '<button type="button" class="btn-small" data-action="ask-finish" data-ci="' + ci + '">' +
            ICONS.check(13) + ' Finished — next match</button>'
        );
      }
    } else if (state.confirmState[ci] === "confirmNext") {
      inner += (
        '<div>' +
          '<div class="confirm-text">Match logged. Generate the next match?</div>' +
          '<button type="button" class="btn-small" style="margin-top:0" data-action="generate-next" data-ci="' + ci + '">' +
            ICONS.shuffle(13) + ' Generate next match</button>' +
        '</div>'
      );
    } else {
      inner += (
        '<div class="court-head"><span class="court-label">Court ' + (ci + 1) + '</span></div>' +
        '<div class="court-idle">' + ICONS.clock(13) + ' Waiting for players</div>'
      );
    }

    return '<div class="court-card' + activeCls + '">' + inner + '</div>';
  }

  function buildCourtsGrid() {
    return '<div class="courts-grid">' + state.courts.map(buildCourtCard).join("") + '</div>';
  }

  function buildWaitingSection(occupied) {
    var waitingPlayers = state.players.filter(function (p) { return !occupied[p.id]; });
    var list;
    if (waitingPlayers.length === 0) {
      list = '<span class="waiting-empty">Everyone\'s on a court.</span>';
    } else {
      list = waitingPlayers.map(function (p) {
        return '<span class="waiting-chip">' + escapeHtml(p.name) + '</span>';
      }).join("");
    }
    return (
      '<div class="waiting-section">' +
        '<div class="section-label">Waiting (' + waitingPlayers.length + ')</div>' +
        '<div class="waiting-list">' + list + '</div>' +
      '</div>'
    );
  }

  function computeStandings() {
    var stats = {};
    state.players.forEach(function (p) {
      stats[p.id] = { id: p.id, name: p.name, matches: 0, wins: 0, losses: 0, pf: 0, pa: 0 };
    });
    state.history.forEach(function (h) {
      var aWon = h.winner === "A";
      h.teamA.forEach(function (p) {
        var s = stats[p.id];
        if (!s) return;
        s.matches += 1;
        s.pf += h.scoreA;
        s.pa += h.scoreB;
        if (aWon) s.wins += 1; else s.losses += 1;
      });
      h.teamB.forEach(function (p) {
        var s = stats[p.id];
        if (!s) return;
        s.matches += 1;
        s.pf += h.scoreB;
        s.pa += h.scoreA;
        if (aWon) s.losses += 1; else s.wins += 1;
      });
    });
    var list = Object.keys(stats).map(function (id) { return stats[id]; });
    list.forEach(function (s) {
      s.diff = s.pf - s.pa;
      s.winRate = s.matches > 0 ? s.wins / s.matches : 0;
    });
    // Rank by wins, then win rate, then point differential, then name —
    // point differential is what keeps players with identical win/loss
    // records (e.g. a three-way tie) from rendering in an arbitrary order.
    list.sort(function (a, b) {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return a.name.localeCompare(b.name);
    });
    return list;
  }

  function buildStandingsRow(s, rank) {
    var pct = Math.round(s.winRate * 100);
    var diffText = (s.diff > 0 ? "+" : "") + s.diff;
    var diffClass = s.diff > 0 ? "pos" : (s.diff < 0 ? "neg" : "");
    return (
      '<div class="standings-row">' +
        '<span class="standings-rank">' + rank + '</span>' +
        '<span class="standings-name">' + escapeHtml(s.name) + '</span>' +
        '<span class="standings-record">' + s.wins + '-' + s.losses + '</span>' +
        '<span class="standings-matches">' + s.matches + '</span>' +
        '<span class="standings-pct">' + pct + '%</span>' +
        '<span class="standings-diff ' + diffClass + '">' + diffText + '</span>' +
      '</div>'
    );
  }

  function buildStandingsSection() {
    if (state.history.length === 0) return "";
    var standings = computeStandings();
    return (
      '<div class="standings-section">' +
        '<div class="section-label">Standings</div>' +
        '<div class="standings-table">' +
          '<div class="standings-row standings-header">' +
            '<span class="standings-rank">#</span>' +
            '<span class="standings-name">Player</span>' +
            '<span class="standings-record">W-L</span>' +
            '<span class="standings-matches">MP</span>' +
            '<span class="standings-pct">Win%</span>' +
            '<span class="standings-diff">+/-</span>' +
          '</div>' +
          standings.map(function (s, i) { return buildStandingsRow(s, i + 1); }).join("") +
        '</div>' +
      '</div>'
    );
  }

  function buildHistoryCard(h) {
    var winA = h.winner === "A";
    var winB = h.winner === "B";
    return (
      '<div class="history-card">' +
        '<div class="net-line"></div>' +
        '<div class="history-head">' +
          '<span class="history-court-label">Court ' + (h.court + 1) + '</span>' +
          '<span class="history-match-num">' + ICONS.check(11) + ' match ' + h.matchNum + '</span>' +
        '</div>' +
        '<div class="history-team-row' + (winA ? " winner" : "") + '">' +
          '<span class="history-team-name">' + (winA ? ICONS.trophy(12, "color:" + BALL_COLOR) : "") + teamNames(h.teamA) + '</span>' +
          '<span class="history-score">' + h.scoreA + '</span>' +
        '</div>' +
        '<div class="history-vs">vs</div>' +
        '<div class="history-team-row' + (winB ? " winner" : "") + '">' +
          '<span class="history-team-name">' + (winB ? ICONS.trophy(12, "color:" + BALL_COLOR) : "") + teamNames(h.teamB) + '</span>' +
          '<span class="history-score">' + h.scoreB + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function buildHistorySection() {
    if (state.history.length === 0) return "";
    return (
      '<div>' +
        '<div class="section-label" style="display:flex;align-items:center;justify-content:space-between">' +
          '<span>Completed matches</span>' +
          '<button type="button" class="btn-ghost-small" data-action="download-history">' + ICONS.download(12) + ' Download CSV</button>' +
        '</div>' +
        '<div class="history-grid">' + state.history.map(buildHistoryCard).join("") + '</div>' +
      '</div>'
    );
  }

  function csvEscape(val) {
    var s = String(val);
    if (/[",\n]/.test(s)) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function downloadHistory() {
    if (state.history.length === 0) return;
    var rows = [["Court", "Match #", "Team A", "Team B", "Score A", "Score B", "Winner"]];
    // history is stored newest-first; export oldest-first so it reads top-to-bottom chronologically
    state.history.slice().reverse().forEach(function (h) {
      var winnerNames = h.winner === "A"
        ? h.teamA.map(function (p) { return p.name; }).join(" & ")
        : h.teamB.map(function (p) { return p.name; }).join(" & ");
      rows.push([
        h.court + 1,
        h.matchNum,
        h.teamA.map(function (p) { return p.name; }).join(" & "),
        h.teamB.map(function (p) { return p.name; }).join(" & "),
        h.scoreA,
        h.scoreB,
        winnerNames,
      ]);
    });
    var csv = rows.map(function (r) { return r.map(csvEscape).join(","); }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = "match-history-" + stamp + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function buildHTML() {
    var occupied = occupiedIds(state.courts);
    var html = '<div class="container">';
    html += buildHeader();
    html += buildSetupPanel(occupied);
    html += buildErrorBanner();
    html += buildActionsRow();
    if (state.sessionStarted) {
      html += buildCourtsGrid();
      html += buildWaitingSection(occupied);
      html += buildStandingsSection();
      html += buildHistorySection();
    }
    html += '</div>';
    return html;
  }

  var root;
  var focusMemo = null; // remembers which input had focus + cursor position across re-renders

  function captureFocus() {
    var el = document.activeElement;
    if (el && root.contains(el) && (el.id === "name-input" || el.id === "num-courts-input" || el.dataset.bind === "score")) {
      focusMemo = {
        id: el.id || null,
        ci: el.dataset ? el.dataset.ci : null,
        team: el.dataset ? el.dataset.team : null,
        selectionStart: el.selectionStart,
        selectionEnd: el.selectionEnd,
      };
    } else {
      focusMemo = null;
    }
  }

  function restoreFocus() {
    if (!focusMemo) return;
    var el = null;
    if (focusMemo.id) {
      el = document.getElementById(focusMemo.id);
    } else if (focusMemo.ci !== null) {
      el = root.querySelector(
        '[data-bind="score"][data-ci="' + focusMemo.ci + '"][data-team="' + focusMemo.team + '"]'
      );
    }
    if (el) {
      el.focus();
      if (typeof focusMemo.selectionStart === "number" && el.setSelectionRange) {
        try {
          el.setSelectionRange(focusMemo.selectionStart, focusMemo.selectionEnd);
        } catch (e) {
          /* ignore inputs that don't support selection (e.g. type=number in some browsers) */
        }
      }
    }
  }

  /* ---------- persistence ---------- */
  var STORAGE_KEY = "open-play-generator-state-v1";

  function saveState() {
    try {
      var toSave = {
        players: state.players,
        numCourts: state.numCourts,
        sessionStarted: state.sessionStarted,
        courts: state.courts,
        matchCounts: state.matchCounts,
        gamesPlayed: state.gamesPlayed,
        benchOrder: state.benchOrder,
        turnCounter: state.turnCounter,
        partnerHistory: state.partnerHistory,
        history: state.history,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      // localStorage unavailable (private browsing, quota, etc.) — fail silently
    }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return;
      Object.keys(saved).forEach(function (key) {
        state[key] = saved[key];
      });
    } catch (e) {
      // corrupted or inaccessible storage — start fresh
    }
  }

  function render() {
    captureFocus();
    root.innerHTML = buildHTML();
    restoreFocus();
    saveState();
  }

  /* ---------- event delegation ---------- */
  function handleClick(e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var action = btn.dataset.action;
    var ci = btn.dataset.ci !== undefined ? Number(btn.dataset.ci) : undefined;
    if (action === "add-player") addPlayer();
    else if (action === "remove-player") removePlayer(btn.dataset.id);
    else if (action === "start-session") startSession();
    else if (action === "ask-end-session") askEndSession();
    else if (action === "cancel-end-session") cancelEndSession();
    else if (action === "reset-all") resetAll();
    else if (action === "ask-finish") askFinishCourt(ci);
    else if (action === "cancel-finish") cancelFinishCourt(ci);
    else if (action === "proceed-score") proceedToScore(ci);
    else if (action === "save-score") saveScoreAndFinish(ci);
    else if (action === "generate-next") generateNextForCourt(ci);
    else if (action === "download-history") downloadHistory();
  }

  function handleInput(e) {
    var t = e.target;
    if (t.id === "name-input") {
      state.nameInput = t.value;
    } else if (t.id === "num-courts-input") {
      state.numCourts = Math.max(1, parseInt(t.value, 10) || 1);
    } else if (t.dataset && t.dataset.bind === "score") {
      var ci = t.dataset.ci;
      var team = t.dataset.team;
      if (!state.scoreDraft[ci]) state.scoreDraft[ci] = { a: "", b: "" };
      state.scoreDraft[ci][team] = t.value;
    }
  }

  function handleKeydown(e) {
    if (e.target && e.target.id === "name-input" && e.key === "Enter") {
      e.preventDefault();
      addPlayer();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    root = document.getElementById("root");
    toastRoot = document.getElementById("toast-root");
    root.addEventListener("click", handleClick);
    root.addEventListener("input", handleInput);
    root.addEventListener("keydown", handleKeydown);
    loadState();
    render();
  });
})();
