// 键盘设置 (C5 到 C7)
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

const whiteKeyWidth = 40;
const blackKeyWidth = 28;
const pianoPadding = 14;
const keyElements = {};

// 音频效果与乐器设置
const reverb = new Tone.Freeverb({ roomSize: 0.35, damping: 4000, wet: 0.25 }).toDestination();
const synth = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 64,
    oscillator: { type: "triangle8" },
    envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.08 }
}).connect(reverb);

// 构建琴键 UI 及上方浮动音符标签
const keyboardEl = document.getElementById('keyboard');
const titleContainer = document.getElementById('titleContainer');
const subTitleContainer = document.getElementById('subTitleContainer');
const fullSheetContainer = document.getElementById('fullSheetContainer');
let whiteKeyCount = 0;

notes.forEach(item => {
    const key = document.createElement('div');
    key.classList.add('key', item.type);
    key.dataset.note = item.note;

    // 创建悬浮音符提示标签
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
    synth.triggerAttackRelease(noteName, '350ms');
    const keyEl = keyElements[noteName];
    if (keyEl) {
        keyEl.classList.add('active');
        setTimeout(() => keyEl.classList.remove('active'), 320);
    }
}

// 曲谱加载与状态变量
let currentSongData = null;
let sequence = [];
let sequenceIndex = 0;
let playbackTimer = null;
let playbackState = 'stopped'; // 'stopped', 'playing', 'paused'
let isMuted = false;

const songSelect = document.getElementById('songSelect');
const playPauseBtn = document.getElementById('playPauseBtn');
const muteToggleBtn = document.getElementById('muteToggleBtn');
const sheetContainer = document.getElementById('fullSheetContainer');


window.addEventListener('DOMContentLoaded', async () => {
    const options = songSelect.querySelectorAll('option');
    for (let opt of options) {
        const filename = opt.value;
        if (!filename) continue;
        try {
            const res = await fetch(`./sheets/${filename}`);
            if (res.ok) {
                const data = await res.json();
                const title = data.chinese_title || data.title;
                const singer = data.singer ? ` - ${data.singer}` : ''; // Includes singer if available
                const difficulty = data.difficulty ? ` (${data.difficulty})` : '';
                
                // Combines title, singer, and difficulty into the dropdown label
                opt.textContent = `${title}${singer}${difficulty}`;
            }
        } catch (e) {
            console.error(`Failed to load metadata for ${filename}`, e);
        }
    }
});

songSelect.addEventListener('change', async (e) => {
    stopPlaybackState();
    const filename = e.target.value;
    
    if (!filename) {
        currentSongData = null;
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
        const response = await fetch(`./sheets/${filename}`);
        if (!response.ok) throw new Error("无法加载曲谱文件。");
        currentSongData = await response.json();
        
        sequence = [];
        fullSheetContainer.innerHTML = "";

        currentSongData.piano.forEach((lineObj, lineIndex) => {
            const lyrics = lineObj.lyrics || "";
            const notesStr = lineObj.notes || "";

            const lineDiv = document.createElement('div');
            lineDiv.classList.add('full-sheet-line');
            lineDiv.dataset.lineIndex = lineIndex;
            lineDiv.innerHTML = `
                <div class="full-lyrics">${lyrics || "(无歌词)"}</div>
                <div class="full-notes">${notesStr}</div>
            `;
            lineDiv.addEventListener('click', () => {
                document.querySelectorAll('.full-sheet-line').forEach(el => el.classList.remove('highlight'));
                lineDiv.classList.add('highlight');
                const targetIndex = sequence.findIndex(item => item.lineIndex === lineIndex);
                if (targetIndex !== -1) {
                    sequenceIndex = targetIndex;
                }
            });
            fullSheetContainer.appendChild(lineDiv);

            notesStr.trim().split(/\s+/).forEach(token => {
                if (token !== "") {
                    sequence.push({ 
                        token: token, 
                        lyricsText: lyrics, 
                        notesLine: notesStr,
                        lineIndex: lineIndex
                    });
                }
            });
        });

        sequenceIndex = 0;

        titleContainer.innerText = currentSongData.title;
        subTitleContainer.innerText = currentSongData.singer || "";
        
        playPauseBtn.disabled = false;
        muteToggleBtn.disabled = false;
    } catch (err) {
        console.error(err);
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

function renderFullSheet(songData) {
    currentSongData = songData;
    sheetContainer.innerHTML = ''; // Clear previous content

    if (!songData || !songData.lines) return;

    songData.lines.forEach((line, lineIndex) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'full-sheet-line';
        lineDiv.dataset.lineIndex = lineIndex;

        const lyricsDiv = document.createElement('div');
        lyricsDiv.className = 'full-lyrics';
        lyricsDiv.textContent = line.lyrics || '';

        const notesDiv = document.createElement('div');
        notesDiv.className = 'full-notes';
        notesDiv.textContent = line.notesText || '';

        lineDiv.appendChild(lyricsDiv);
        lineDiv.appendChild(notesDiv);

        // Click handler: highlight and play the clicked line on demand
        lineDiv.addEventListener('click', () => {
            // Remove highlight from all lines
            document.querySelectorAll('.full-sheet-line').forEach(el => el.classList.remove('highlight'));
            // Highlight the clicked line
            lineDiv.classList.add('highlight');

            // Trigger playback or jump to this specific line
            if (typeof playLineSequence === 'function') {
                playLineSequence(lineIndex);
            }
        });

        sheetContainer.appendChild(lineDiv);
    });
}

// 静音切换按钮（使用图标图形）
muteToggleBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
        muteToggleBtn.classList.add('active');
        muteToggleBtn.innerText = "🔇";
        muteToggleBtn.title = "已静音";
    } else {
        muteToggleBtn.classList.remove('active');
        muteToggleBtn.innerText = "🔊";
        muteToggleBtn.title = "静音";
    }
});

function runPlayback() {
    playbackState = 'playing';
    playPauseBtn.innerText = "⏸";
    playPauseBtn.title = "暂停";
    // songSelect.disabled = true;

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

// Play/Pause 图形按钮切换逻辑
playPauseBtn.addEventListener('click', async () => {
    if (!currentSongData) return;

    if (playbackState === 'stopped' || playbackState === 'paused') {
        if (!isMuted) {
            await Tone.start();
        }
        if (sequenceIndex >= sequence.length) {
            sequenceIndex = 0;
        }
        runPlayback();
    } else if (playbackState === 'playing') {
        clearInterval(playbackTimer);
        playbackState = 'paused';
        playPauseBtn.innerText = "▶";
        playPauseBtn.title = "继续";
    }
});

function stopPlaybackState() {
    if (playbackTimer) clearInterval(playbackTimer);
    playbackTimer = null;
    playbackState = 'stopped';
    synth.releaseAll();
    playPauseBtn.innerText = "▶";
    playPauseBtn.title = "播放";
    playPauseBtn.disabled = !currentSongData;
    muteToggleBtn.disabled = !currentSongData;
    songSelect.disabled = false;
    
    const lineElements = fullSheetContainer.querySelectorAll('.full-sheet-line');
    lineElements.forEach(el => el.classList.remove('highlight'));
}

// --- Instrument Toggle Setup ---
const instruments = [
    { name: 'default', emoji: '🎼', desc: '默认音色' },
    { name: 'piano', emoji: '🎹', desc: '钢琴音色' },
    { name: 'violin', emoji: '🎻', desc: '小提琴音色' }
];
let currentInstrumentIndex = 0;

const instrumentToggleBtn = document.getElementById('instrumentToggleBtn');

instrumentToggleBtn.addEventListener('click', () => {
    // Cycle to the next instrument
    currentInstrumentIndex = (currentInstrumentIndex + 1) % instruments.length;
    const currentInst = instruments[currentInstrumentIndex];
    
    // Update button icon and tooltip
    instrumentToggleBtn.innerText = currentInst.emoji;
    instrumentToggleBtn.title = currentInst.desc;
    
    // Adjust Tone.js synth parameters to mimic the selected instrument's vibe
    updateSynthInstrument(currentInst.name);
});

// Function to modify synth characteristics based on the selected emoji
function updateSynthInstrument(instName) {
    if (instName === 'violin') {
        // Violin-like: smoother attack, but shorter release/sustain to prevent overlapping drone
        synth.set({
            oscillator: { type: "sawtooth" },
            envelope: { attack: 0.05, decay: 0.15, sustain: 0, release: 0.1 }
        });
        synth.connect(reverb);
    } else if (instName === 'piano') {
        // Piano-like: sharp attack, quick decay, percussive feel
        synth.set({
            oscillator: { type: "sine" },
            envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.08 }
        });
        synth.connect(reverb);
    } else {
        // Default 🎼 setting
        synth.set({
            oscillator: { type: "triangle8" },
            envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.08 }
        });
        synth.connect(reverb);
    }
}