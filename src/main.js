import * as Tone from 'tone';

// Lower the initial volume while preserving the existing mute toggle.
Tone.Destination.volume.value = -10;

const notes = [
    { note: 'C5', type: 'white' }, { note: 'C#5', type: 'black' },
    { note: 'D5', type: 'white' }, { note: 'D#5', type: 'black' },
    { note: 'E5', type: 'white' }, { note: 'F5', type: 'white' },
    { note: 'F#5', type: 'black' }, { note: 'G5', type: 'white' },
    { note: 'G#5', type: 'black' }, { note: 'A5', type: 'white' },
    { note: 'A#5', type: 'black' }, { note: 'B5', type: 'white' },
    { note: 'C6', type: 'white' }, { note: 'C#6', type: 'black' },
    { note: 'D6', type: 'white' }, { note: 'D#6', type: 'black' },
    { note: 'E6', type: 'white' }, { note: 'F6', type: 'white' },
    { note: 'F#6', type: 'black' }, { note: 'G6', type: 'white' },
    { note: 'G#6', type: 'black' }, { note: 'A6', type: 'white' },
    { note: 'A#6', type: 'black' }, { note: 'B6', type: 'white' },
    { note: 'C7', type: 'white' }
];

const SONG_SELECT_DEFAULT = '<option value="">请选择曲谱</option>';
const KEY_SELECT_DEFAULT = '<option value="">请选择调式</option>';
const MAJOR_KEY_OPTIONS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTE_PITCH_CLASSES = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11
};
const PITCH_CLASS_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LOWEST_PLAYABLE_MIDI = 72; // C5
const HIGHEST_PLAYABLE_MIDI = 96; // C7
const SONG_LIST_URL = '/sheets/song-list.txt';
const getSheetUrl = (filename) => `/sheets/${encodeURIComponent(filename)}`;

const whiteKeyWidth = 40;
const blackKeyWidth = 28;
const pianoPadding = 14;
const keyElements = {};

const reverb = new Tone.Freeverb({ roomSize: 0.35, damping: 4000, wet: 0.15 }).toDestination();

const synth = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 64,
    oscillator: { type: 'sine2' },
    envelope: { attack: 0.03, decay: 0.5, sustain: 0.005, release: 0.8 }
}).toDestination();

let activeInstrument = 'default';
let currentSongData = null;
let sequence = [];
let sequenceIndex = 0;
let playbackTimer = null;
let playbackState = 'stopped';
let practiceMode = false;
let practicePauseTimer = null;
let isMuted = false;

const keyboardEl = document.getElementById('keyboard');
const pianoContainerEl = document.querySelector('.piano-container');
const backgroundThemeButtons = document.querySelectorAll('[data-background-theme]');
const displayBoard = document.getElementById('display-board');
const titleContainer = document.getElementById('titleContainer');
const subTitleContainer = document.getElementById('subTitleContainer');
const fullSheetContainer = document.getElementById('fullSheetContainer');
const practiceCompleteMessage = document.getElementById('practiceCompleteMessage');
const songSelect = document.getElementById('songSelect');
const keySelect = document.getElementById('keySelect');
const keyPickerTitle = document.getElementById('keyPickerTitle');
const keyTitleText = document.getElementById('keyTitleText');
const playPauseBtn = document.getElementById('playPauseBtn');
const practiceBtn = document.getElementById('practiceBtn');
const muteToggleBtn = document.getElementById('muteToggleBtn');
const instrumentToggleBtn = document.getElementById('instrumentToggleBtn');
const hideControlsBtn = document.getElementById('hideControlsBtn');
const infoToggleBtn = document.getElementById('infoToggleBtn');
const infoPanel = document.getElementById('infoPanel');

let whiteKeyCount = 0;
notes.forEach(item => {
    const key = document.createElement('div');
    key.classList.add('key', item.type);
    key.dataset.note = item.note;

    const popup = document.createElement('div');
    popup.classList.add('note-popup');
    popup.innerText = item.note;
    key.appendChild(popup);

    if (item.type === 'black') {
        key.dataset.whiteKeyCount = whiteKeyCount;
        key.style.left = `${pianoPadding + (whiteKeyCount * whiteKeyWidth) - (blackKeyWidth / 2)}px`;
    } else {
        whiteKeyCount += 1;
    }

    key.addEventListener('pointerdown', async () => {
        await Tone.start();
        playNote(item.note);
        handlePracticeKeyPress(item.note);
    });

    keyboardEl.appendChild(key);
    keyElements[item.note] = key;
});

// Keep every key visible on narrow screens instead of requiring horizontal scrolling.
function resizeKeyboard() {
    const containerStyles = getComputedStyle(pianoContainerEl);
    const keyboardStyles = getComputedStyle(keyboardEl);
    const containerInset = parseFloat(containerStyles.paddingLeft) + parseFloat(containerStyles.paddingRight);
    const keyboardPadding = parseFloat(keyboardStyles.paddingLeft) + parseFloat(keyboardStyles.paddingRight);
    const keyboardLeftPadding = parseFloat(keyboardStyles.paddingLeft);
    const pianoBorder = parseFloat(keyboardStyles.borderLeftWidth) + parseFloat(keyboardStyles.borderRightWidth);
    const availableWhiteKeySpace = pianoContainerEl.clientWidth - containerInset - keyboardPadding - pianoBorder;
    const fittedWhiteKeyWidth = Math.min(whiteKeyWidth, Math.max(14, availableWhiteKeySpace / whiteKeyCount));
    const fittedBlackKeyWidth = fittedWhiteKeyWidth * (blackKeyWidth / whiteKeyWidth);

    keyboardEl.style.setProperty('--white-key-width', `${fittedWhiteKeyWidth}px`);
    keyboardEl.style.setProperty('--black-key-width', `${fittedBlackKeyWidth}px`);
    keyboardEl.style.setProperty('--white-key-height', `${fittedWhiteKeyWidth * (150 / whiteKeyWidth)}px`);
    keyboardEl.style.setProperty('--black-key-height', `${fittedWhiteKeyWidth * (90 / whiteKeyWidth)}px`);

    keyboardEl.querySelectorAll('.black').forEach(key => {
        const precedingWhiteKeys = Number(key.dataset.whiteKeyCount);
        key.style.left = `${keyboardLeftPadding + (precedingWhiteKeys * fittedWhiteKeyWidth) - (fittedBlackKeyWidth / 2)}px`;
    });
}

new ResizeObserver(resizeKeyboard).observe(pianoContainerEl);
requestAnimationFrame(resizeKeyboard);

function setBackgroundTheme(theme) {
    document.body.dataset.backgroundTheme = theme;
}

function getThemeForLocalTime(date = new Date()) {
    const hour = date.getHours();
    return hour >= 6 && hour < 18 ? 'dawn' : 'night';
}

function scheduleThemeForLocalTime() {
    const now = new Date();
    setBackgroundTheme(getThemeForLocalTime(now));

    const nextChange = new Date(now);
    if (now.getHours() < 6) {
        nextChange.setHours(6, 0, 0, 0);
    } else if (now.getHours() < 18) {
        nextChange.setHours(18, 0, 0, 0);
    } else {
        nextChange.setDate(nextChange.getDate() + 1);
        nextChange.setHours(6, 0, 0, 0);
    }

    setTimeout(scheduleThemeForLocalTime, nextChange.getTime() - now.getTime() + 100);
}

backgroundThemeButtons.forEach(button => {
    const theme = button.dataset.backgroundTheme;
    if (button === document.body || !theme) return;

    button.addEventListener('click', () => setBackgroundTheme(theme));
    button.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setBackgroundTheme(theme);
        }
    });
});

scheduleThemeForLocalTime();

function playNote(noteName) {
    synth.triggerAttackRelease(noteName, '2n');

    const keyEl = keyElements[normalizeNoteName(noteName)];
    if (keyEl) {
        keyEl.classList.add('active');
        setTimeout(() => keyEl.classList.remove('active'), 320);
    }
}

function hidePracticeCompleteMessage() {
    practiceCompleteMessage.hidden = true;
}

function showPracticeCompleteMessage() {
    practiceCompleteMessage.hidden = false;
}

function bindEmptySongSelect() {
    const emptySongSelect = document.getElementById('emptySongSelect');
    if (!emptySongSelect) return;

    emptySongSelect.innerHTML = songSelect.innerHTML;
    emptySongSelect.value = songSelect.value;
    emptySongSelect.addEventListener('change', event => {
        songSelect.value = event.target.value;
        songSelect.dispatchEvent(new Event('change'));
    });
}

function renderEmptySheetPrompt(message = '请选择一首曲谱开始') {
    fullSheetContainer.innerHTML = `
        <div class="full-sheet-line empty-sheet-line">
            <div class="full-lyrics empty-song-picker">${message}
                <select id="emptySongSelect" aria-label="选择曲谱"></select>
            </div>
            <div class="full-notes"></div>
        </div>
    `;
    bindEmptySongSelect();
}

renderEmptySheetPrompt();

function parseNote(noteName) {
    const match = /^([A-G][#b]?)(\d)$/.exec(noteName);
    if (!match) return null;

    return {
        pitchClass: match[1],
        octave: Number(match[2])
    };
}

function noteToMidi(noteName) {
    const parsedNote = parseNote(noteName);
    if (!parsedNote || NOTE_PITCH_CLASSES[parsedNote.pitchClass] === undefined) return null;

    return (parsedNote.octave + 1) * 12 + NOTE_PITCH_CLASSES[parsedNote.pitchClass];
}

function midiToNote(midiValue) {
    const pitchClass = ((midiValue % 12) + 12) % 12;
    const octave = Math.floor(midiValue / 12) - 1;
    return `${PITCH_CLASS_NOTES[pitchClass]}${octave}`;
}

function normalizeNoteName(noteName) {
    const midiValue = noteToMidi(noteName);
    return midiValue === null ? noteName : midiToNote(midiValue);
}

function getKeyRoot(keyName) {
    const match = /^([A-G][#b]?)/.exec(keyName || '');
    return match ? normalizeNoteName(`${match[1]}4`).replace(/\d$/, '') : null;
}

function getSourcePianoVariant() {
    const pianoVariants = Array.isArray(currentSongData?.piano) ? currentSongData.piano : [];
    if (!pianoVariants.length) return null;

    return pianoVariants.find(entry => entry?.key === currentSongData?.baseKey)
        || pianoVariants.find(entry => entry?.key === 'C')
        || pianoVariants[0];
}

function getTranspositionShift(sourceKey, targetKey, sheetLines) {
    sourceKey = getKeyRoot(sourceKey);
    targetKey = getKeyRoot(targetKey);
    if (NOTE_PITCH_CLASSES[sourceKey] === undefined || NOTE_PITCH_CLASSES[targetKey] === undefined) return null;

    const noteMidiValues = sheetLines
        .flatMap(lineObj => (lineObj.notes || '').trim().split(/\s+/))
        .filter(token => token && token !== '-')
        .map(noteToMidi);

    if (noteMidiValues.some(midiValue => midiValue === null)) return null;

    const baseShift = NOTE_PITCH_CLASSES[targetKey] - NOTE_PITCH_CLASSES[sourceKey];
    const candidateShifts = Array.from({ length: 7 }, (_, index) => baseShift + ((index - 3) * 12));

    return candidateShifts
        .filter(shift => noteMidiValues.every(midiValue => {
            const transposedMidi = midiValue + shift;
            return transposedMidi >= LOWEST_PLAYABLE_MIDI && transposedMidi <= HIGHEST_PLAYABLE_MIDI;
        }))
        .sort((a, b) => Math.abs(a) - Math.abs(b))[0] ?? null;
}

function transposeNote(token, shift) {
    if (token === '-' || token === '') return token;

    const midiValue = noteToMidi(token);
    if (midiValue === null) return token;

    return midiToNote(midiValue + shift);
}

function transposeNotesString(notesStr, shift) {
    return notesStr.trim().split(/\s+/).filter(Boolean).map(token => transposeNote(token, shift)).join(' ');
}

function renderNoteTokens(notesStr, lineIndex) {
    return notesStr.trim().split(/\s+/).filter(Boolean).map((token, tokenIndex) => {
        const className = token === '-' ? 'sheet-note pause' : 'sheet-note';
        return `<span class="${className}" data-line-index="${lineIndex}" data-token-index="${tokenIndex}">${token}</span>`;
    }).join(' ');
}

function renderSheetForKey(keyName) {
    hidePracticeCompleteMessage();
    const sourceVariant = getSourcePianoVariant();
    const sourceKey = sourceVariant?.key || currentSongData?.baseKey || 'C';
    const sourceSheetLines = Array.isArray(sourceVariant?.sheet) ? sourceVariant.sheet : [];
    const transpositionShift = getTranspositionShift(sourceKey, keyName, sourceSheetLines);
    const sheetLines = transpositionShift === null
        ? []
        : sourceSheetLines.map(lineObj => ({
            ...lineObj,
            notes: transposeNotesString(lineObj.notes || '', transpositionShift)
        }));

    sequence = [];
    fullSheetContainer.innerHTML = '';

    sheetLines.forEach((lineObj, lineIndex) => {
        const lyrics = lineObj.lyrics || '';
        const notesStr = lineObj.notes || '';
        const lineDiv = document.createElement('div');
        lineDiv.classList.add('full-sheet-line');
        lineDiv.dataset.lineIndex = lineIndex;
        lineDiv.innerHTML = `
            <div class="full-lyrics">${lyrics || '(无歌词)'}</div>
            <div class="full-notes">${renderNoteTokens(notesStr, lineIndex)}</div>
        `;
        lineDiv.addEventListener('click', () => {
            document.querySelectorAll('.full-sheet-line').forEach(el => el.classList.remove('highlight'));
            lineDiv.classList.add('highlight');
            const targetIndex = sequence.findIndex(item => item.lineIndex === lineIndex);
            if (targetIndex !== -1) {
                sequenceIndex = targetIndex;
                updateCurrentNoteHighlight();
            }
        });
        fullSheetContainer.appendChild(lineDiv);

        notesStr.trim().split(/\s+/).forEach((token, tokenIndex) => {
            if (token !== '') {
                sequence.push({ token, lyricsText: lyrics, notesLine: notesStr, lineIndex, tokenIndex });
            }
        });
    });

    sequenceIndex = 0;
    updateCurrentNoteHighlight();
}

function clearPracticePauseTimer() {
    if (practicePauseTimer) {
        clearTimeout(practicePauseTimer);
        practicePauseTimer = null;
    }
}

function clearCurrentNoteHighlight() {
    fullSheetContainer.querySelectorAll('.sheet-note.current').forEach(el => el.classList.remove('current'));
    Object.values(keyElements).forEach(key => key.classList.remove('practice-target'));
}

function updateCurrentNoteHighlight() {
    clearCurrentNoteHighlight();
    if (!practiceMode || sequenceIndex >= sequence.length) return;

    const currentItem = sequence[sequenceIndex];
    const lineElements = fullSheetContainer.querySelectorAll('.full-sheet-line');
    lineElements.forEach((el, idx) => {
        if (idx === currentItem.lineIndex) {
            el.classList.add('highlight');
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            el.classList.remove('highlight');
        }
    });

    const noteEl = fullSheetContainer.querySelector(
        `.sheet-note[data-line-index="${currentItem.lineIndex}"][data-token-index="${currentItem.tokenIndex}"]`
    );
    noteEl?.classList.add('current');

    if (currentItem.token === '-') {
        clearPracticePauseTimer();
        practicePauseTimer = setTimeout(() => advancePracticeStep(), 320);
        return;
    }

    keyElements[normalizeNoteName(currentItem.token)]?.classList.add('practice-target');
}

function advancePracticeStep() {
    clearPracticePauseTimer();
    sequenceIndex += 1;
    if (sequenceIndex >= sequence.length) {
        stopPlaybackState({ keepCompletionMessage: true });
        showPracticeCompleteMessage();
        return;
    }

    updateCurrentNoteHighlight();
}

function handlePracticeKeyPress(noteName) {
    if (!practiceMode || sequenceIndex >= sequence.length) return;

    const currentItem = sequence[sequenceIndex];
    if (normalizeNoteName(currentItem.token) === normalizeNoteName(noteName)) {
        advancePracticeStep();
    }
}

function populateKeyOptions() {
    const sourceVariant = getSourcePianoVariant();
    const sourceSheetLines = Array.isArray(sourceVariant?.sheet) ? sourceVariant.sheet : [];
    const sourceKey = getKeyRoot(sourceVariant?.key || currentSongData?.baseKey) || 'C';

    if (!currentSongData || !sourceVariant || !sourceSheetLines.length) {
        keySelect.innerHTML = KEY_SELECT_DEFAULT;
        keySelect.disabled = true;
        return;
    }

    const validKeys = MAJOR_KEY_OPTIONS.filter(keyName => (
        getTranspositionShift(sourceKey, keyName, sourceSheetLines) !== null
    ));

    keySelect.innerHTML = KEY_SELECT_DEFAULT;
    validKeys.forEach(keyName => {
        const option = document.createElement('option');
        option.value = keyName;
        option.textContent = `${keyName} 调`;
        keySelect.appendChild(option);
    });

    const defaultKey = validKeys.includes(sourceKey) ? sourceKey : (validKeys[0] || '');
    keySelect.disabled = validKeys.length <= 1;
    keySelect.value = defaultKey;
    keyPickerTitle.hidden = !validKeys.length;
    keyTitleText.innerText = keySelect.value ? `${keySelect.value} 调` : '';
}

songSelect.addEventListener('change', async (e) => {
    stopPlaybackState();
    const filename = e.target.value;

    if (!filename) {
        currentSongData = null;
        keySelect.innerHTML = KEY_SELECT_DEFAULT;
        keySelect.disabled = true;
        keyPickerTitle.hidden = true;
        keyTitleText.innerText = '';
        playPauseBtn.disabled = true;
        practiceBtn.disabled = true;
        muteToggleBtn.disabled = true;
        titleContainer.innerText = '希朝音乐盒模拟器';
        subTitleContainer.innerText = '';
        renderEmptySheetPrompt();
        return;
    }

    try {
        const response = await fetch(getSheetUrl(filename));
        if (!response.ok) throw new Error('无法加载曲谱文件。');
        currentSongData = await response.json();

        populateKeyOptions();
        renderSheetForKey(keySelect.value || 'C');

        titleContainer.innerText = currentSongData.title;
        subTitleContainer.innerText = currentSongData.singer || '';
        playPauseBtn.disabled = false;
        practiceBtn.disabled = false;
        muteToggleBtn.disabled = false;
    } catch (err) {
        console.error(err);
        currentSongData = null;
        keySelect.innerHTML = KEY_SELECT_DEFAULT;
        keySelect.disabled = true;
        keyPickerTitle.hidden = true;
        keyTitleText.innerText = '';
        renderEmptySheetPrompt('加载曲谱 JSON 出错！');
        playPauseBtn.disabled = true;
        practiceBtn.disabled = true;
        muteToggleBtn.disabled = true;
    }
});

keySelect.addEventListener('change', () => {
    if (!currentSongData) return;
    stopPlaybackState();
    keyTitleText.innerText = keySelect.value ? `${keySelect.value} 调` : '';
    renderSheetForKey(keySelect.value || 'C');
});

function runPlayback() {
    if (practiceMode) setPracticeMode(false);
    hidePracticeCompleteMessage();
    playbackState = 'playing';
    playPauseBtn.innerText = '⏸';
    playPauseBtn.title = '暂停';

    const tempoInterval = 320;
    playbackTimer = setInterval(() => {
        if (sequenceIndex >= sequence.length) {
            stopPlaybackState();
            return;
        }

        const currentItem = sequence[sequenceIndex];
        const lineElements = fullSheetContainer.querySelectorAll('.full-sheet-line');
        lineElements.forEach((el, idx) => {
            if (idx === currentItem.lineIndex) {
                el.classList.add('highlight');
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                el.classList.remove('highlight');
            }
        });

        const token = currentItem.token;
        if (token !== '-' && token !== '') {
            if (!isMuted) {
                playNote(token);
            } else {
                const keyEl = keyElements[normalizeNoteName(token)];
                if (keyEl) {
                    keyEl.classList.add('active');
                    setTimeout(() => keyEl.classList.remove('active'), 300);
                }
            }
        }
        sequenceIndex++;
    }, tempoInterval);
}

playPauseBtn.addEventListener('click', async () => {
    if (!currentSongData) return;
    if (playbackState === 'stopped' || playbackState === 'paused') {
        if (!isMuted) await Tone.start();
        if (sequenceIndex >= sequence.length) sequenceIndex = 0;
        runPlayback();
    } else if (playbackState === 'playing') {
        clearInterval(playbackTimer);
        playbackState = 'paused';
        playPauseBtn.innerText = '▶';
        playPauseBtn.title = '继续';
    }
});

function stopPlaybackState({ keepCompletionMessage = false } = {}) {
    if (playbackTimer) clearInterval(playbackTimer);
    clearPracticePauseTimer();
    playbackTimer = null;
    playbackState = 'stopped';
    practiceMode = false;
    playPauseBtn.innerText = '▶';
    playPauseBtn.title = '播放';
    practiceBtn.classList.remove('active');
    practiceBtn.innerText = '✋';
    practiceBtn.title = '练习模式';
    playPauseBtn.disabled = !currentSongData;
    practiceBtn.disabled = !currentSongData;
    muteToggleBtn.disabled = !currentSongData;
    songSelect.disabled = false;
    if (!keepCompletionMessage) hidePracticeCompleteMessage();

    fullSheetContainer.querySelectorAll('.full-sheet-line').forEach(el => el.classList.remove('highlight'));
    clearCurrentNoteHighlight();
}

function setPracticeMode(isEnabled) {
    practiceMode = isEnabled;
    clearPracticePauseTimer();

    if (practiceMode) {
        hidePracticeCompleteMessage();
        if (playbackTimer) clearInterval(playbackTimer);
        playbackTimer = null;
        playbackState = 'stopped';
        playPauseBtn.innerText = '▶';
        playPauseBtn.title = '播放';
        if (sequenceIndex >= sequence.length) sequenceIndex = 0;
        practiceBtn.classList.add('active');
        practiceBtn.innerText = '👆';
        practiceBtn.title = '退出练习模式';
        updateCurrentNoteHighlight();
    } else {
        practiceBtn.classList.remove('active');
        practiceBtn.innerText = '✋';
        practiceBtn.title = '练习模式';
        clearCurrentNoteHighlight();
    }
}

practiceBtn.addEventListener('click', () => {
    if (!currentSongData) return;
    setPracticeMode(!practiceMode);
});

hideControlsBtn.addEventListener('click', () => {
    const controlsHidden = displayBoard.classList.toggle('controls-hidden');
    hideControlsBtn.classList.toggle('active', controlsHidden);
    hideControlsBtn.innerText = controlsHidden ? '▾' : '▴';
    hideControlsBtn.title = controlsHidden ? '显示控制' : '隐藏控制';
});

function setInfoPanelOpen(isOpen) {
    infoPanel.hidden = !isOpen;
    infoToggleBtn.setAttribute('aria-expanded', String(isOpen));
}

infoToggleBtn.addEventListener('click', event => {
    event.stopPropagation();
    setInfoPanelOpen(infoPanel.hidden);
});

infoPanel.addEventListener('click', event => {
    event.stopPropagation();
});

document.addEventListener('click', () => {
    if (!infoPanel.hidden) setInfoPanelOpen(false);
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !infoPanel.hidden) {
        setInfoPanelOpen(false);
        infoToggleBtn.focus();
    }
});

muteToggleBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
        muteToggleBtn.classList.add('active');
        muteToggleBtn.innerText = '🔇';
        muteToggleBtn.title = '已静音';
    } else {
        muteToggleBtn.classList.remove('active');
        muteToggleBtn.innerText = '🔊';
        muteToggleBtn.title = '静音';
    }
});

const instruments = [
    { name: 'default', emoji: '🎶', desc: '默认音色' },
    { name: 'piano', emoji: '🎹', desc: '钢琴音色' },
    { name: 'violin', emoji: '🎻', desc: '小提琴音色' }
];
let currentInstrumentIndex = 0;

instrumentToggleBtn.addEventListener('click', () => {
    currentInstrumentIndex = (currentInstrumentIndex + 1) % instruments.length;
    const currentInst = instruments[currentInstrumentIndex];
    instrumentToggleBtn.innerText = currentInst.emoji;
    instrumentToggleBtn.title = currentInst.desc;
    updateSynthInstrument(currentInst.name);
});

function updateSynthInstrument(instName) {
    synth.disconnect();
    activeInstrument = instName;
    if (instName === 'violin') {
        synth.set({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.05, decay: 1.5, sustain: 0.02, release: 0.8 }
        });
        synth.connect(reverb);
    } else if (instName === 'piano') {
        synth.set({
            oscillator: { type: 'square' },
            envelope: {
                attack: 0.01,
                decay: 0.8,
                sustain: 0.01,
                release: 0.8
            }
        })
        synth.connect(reverb);;
    } else {
        synth.set({
            oscillator: { type: 'sine2' },
            envelope: { attack: 0.03, decay: 0.5, sustain: 0.005, release: 0.8 }
        });
        synth.toDestination();
    }
}

async function populateSongOptions() {
    songSelect.innerHTML = SONG_SELECT_DEFAULT;
    let songFiles = [];

    try {
        const response = await fetch(SONG_LIST_URL);
        if (!response.ok) throw new Error('Unable to load song list.');
        const songListText = await response.text();
        songFiles = songListText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    } catch (error) {
        console.error('Failed to load song list.', error);
    }

    for (const filename of songFiles) {
        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename.replace(/\.json$/i, '');

        try {
            const res = await fetch(getSheetUrl(filename));
            if (res.ok) {
                const data = await res.json();
                const title = data.chinese_title || data.title;
                const singer = data.singer ? ` - ${data.singer}` : '';
                const difficulty = data.difficulty ? ` (${data.difficulty})` : '';
                option.textContent = `${title}${singer}${difficulty}`;
            }
        } catch (e) {
            console.error(`Failed to load metadata for ${filename}`, e);
        }

        songSelect.appendChild(option);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    await populateSongOptions();
    bindEmptySongSelect();
});
