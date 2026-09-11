import * as Tone from 'tone';

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
const getSheetUrl = (filename) => `./sheets/${filename}`;

const whiteKeyWidth = 40;
const blackKeyWidth = 28;
const pianoPadding = 14;
const keyElements = {};

const reverb = new Tone.Freeverb({ roomSize: 0.35, damping: 4000, wet: 0.15 }).toDestination();

const synth = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 64,
    oscillator: { type: 'sine2' },
    envelope: { attack: 0.001, decay: 1.5, sustain: 0.01, release: 0.8 }
}).toDestination();

let activeInstrument = 'default';
let currentSongData = null;
let sequence = [];
let sequenceIndex = 0;
let playbackTimer = null;
let playbackState = 'stopped';
let isMuted = false;

const keyboardEl = document.getElementById('keyboard');
const titleContainer = document.getElementById('titleContainer');
const subTitleContainer = document.getElementById('subTitleContainer');
const fullSheetContainer = document.getElementById('fullSheetContainer');
const songSelect = document.getElementById('songSelect');
const keySelect = document.getElementById('keySelect');
const playPauseBtn = document.getElementById('playPauseBtn');
const muteToggleBtn = document.getElementById('muteToggleBtn');
const instrumentToggleBtn = document.getElementById('instrumentToggleBtn');

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
        key.style.left = `${pianoPadding + (whiteKeyCount * whiteKeyWidth) - (blackKeyWidth / 2)}px`;
    } else {
        whiteKeyCount += 1;
    }

    key.addEventListener('mousedown', async () => {
        await Tone.start();
        playNote(item.note);
    });

    keyboardEl.appendChild(key);
    keyElements[item.note] = key;
});

function playNote(noteName) {
    synth.triggerAttackRelease(noteName, '2n');

    const keyEl = keyElements[noteName];
    if (keyEl) {
        keyEl.classList.add('active');
        setTimeout(() => keyEl.classList.remove('active'), 320);
    }
}

function renderSheetForKey(keyName) {
    const pianoVariants = Array.isArray(currentSongData?.piano) ? currentSongData.piano : [];
    const selectedVariant = pianoVariants.find(entry => entry && entry.key === keyName) || pianoVariants[0] || null;
    const sheetLines = selectedVariant && Array.isArray(selectedVariant.sheet) ? selectedVariant.sheet : [];

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
            <div class="full-notes">${notesStr}</div>
        `;
        lineDiv.addEventListener('click', () => {
            document.querySelectorAll('.full-sheet-line').forEach(el => el.classList.remove('highlight'));
            lineDiv.classList.add('highlight');
            const targetIndex = sequence.findIndex(item => item.lineIndex === lineIndex);
            if (targetIndex !== -1) sequenceIndex = targetIndex;
        });
        fullSheetContainer.appendChild(lineDiv);

        notesStr.trim().split(/\s+/).forEach(token => {
            if (token !== '') {
                sequence.push({ token, lyricsText: lyrics, notesLine: notesStr, lineIndex });
            }
        });
    });

    sequenceIndex = 0;
}

function populateKeyOptions() {
    if (!currentSongData || !Array.isArray(currentSongData.piano)) {
        keySelect.innerHTML = KEY_SELECT_DEFAULT;
        keySelect.disabled = true;
        return;
    }

    const variants = currentSongData.piano.filter(entry => entry && entry.key);
    keySelect.innerHTML = KEY_SELECT_DEFAULT;
    variants.forEach(entry => {
        const option = document.createElement('option');
        option.value = entry.key;
        option.textContent = `${entry.key} 调`;
        keySelect.appendChild(option);
    });

    const defaultKey = variants.some(entry => entry.key === 'C') ? 'C' : (variants[0]?.key || '');
    keySelect.disabled = variants.length <= 1;
    keySelect.value = defaultKey;
}

songSelect.addEventListener('change', async (e) => {
    stopPlaybackState();
    const filename = e.target.value;

    if (!filename) {
        currentSongData = null;
        keySelect.innerHTML = KEY_SELECT_DEFAULT;
        keySelect.disabled = true;
        playPauseBtn.disabled = true;
        muteToggleBtn.disabled = true;
        fullSheetContainer.innerHTML = `
            <div class="full-sheet-line">
                <div class="full-lyrics">请选择一首曲谱开始</div>
                <div class="full-notes"></div>
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(getSheetUrl(filename));
        if (!response.ok) throw new Error('无法加载曲谱文件。');
        currentSongData = await response.json();

        populateKeyOptions();
        renderSheetForKey(keySelect.value || (currentSongData.piano[0]?.key || 'C'));

        titleContainer.innerText = currentSongData.title;
        subTitleContainer.innerText = currentSongData.singer || '';
        playPauseBtn.disabled = false;
        muteToggleBtn.disabled = false;
    } catch (err) {
        console.error(err);
        currentSongData = null;
        keySelect.innerHTML = KEY_SELECT_DEFAULT;
        keySelect.disabled = true;
        fullSheetContainer.innerHTML = `
            <div class="full-sheet-line">
                <div class="full-lyrics">加载曲谱 JSON 出错！</div>
                <div class="full-notes"></div>
            </div>
        `;
        playPauseBtn.disabled = true;
        muteToggleBtn.disabled = true;
    }
});

keySelect.addEventListener('change', () => {
    if (!currentSongData) return;
    stopPlaybackState();
    renderSheetForKey(keySelect.value || 'C');
});

function runPlayback() {
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
                const keyEl = keyElements[token];
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

function stopPlaybackState() {
    if (playbackTimer) clearInterval(playbackTimer);
    playbackTimer = null;
    playbackState = 'stopped';
    playPauseBtn.innerText = '▶';
    playPauseBtn.title = '播放';
    playPauseBtn.disabled = !currentSongData;
    muteToggleBtn.disabled = !currentSongData;
    songSelect.disabled = false;

    fullSheetContainer.querySelectorAll('.full-sheet-line').forEach(el => el.classList.remove('highlight'));
}

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
    { name: 'default', emoji: '🎼', desc: '默认音色' },
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
            envelope: { attack: 0.001, decay: 1.5, sustain: 0.01, release: 0.8 }
        });
        synth.toDestination();
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const options = songSelect.querySelectorAll('option');
    for (const opt of options) {
        const filename = opt.value;
        if (!filename) continue;
        try {
            const res = await fetch(getSheetUrl(filename));
            if (res.ok) {
                const data = await res.json();
                const title = data.chinese_title || data.title;
                const singer = data.singer ? ` - ${data.singer}` : '';
                const difficulty = data.difficulty ? ` (${data.difficulty})` : '';
                opt.textContent = `${title}${singer}${difficulty}`;
            }
        } catch (e) {
            console.error(`Failed to load metadata for ${filename}`, e);
        }
    }
});
