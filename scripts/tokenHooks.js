let microphoneButton;
let stopRecordingButton;
let cancelRecordingButton;
let elapsedTimeTag;
let recordingControlButtonsContainer;
let audioElementSource;
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
script.onload = () => {
    console.log('lame.min.js loaded successfully.');
};
script.onerror = () => {
    console.error('Failed to load lame.min.js.');
};
document.head.appendChild(script);

export function registerTokenHooks() {
    Hooks.on('renderTokenHUD', async (hud, html, token) => {
        const actor = game.actors.get(token.actorId);
        if (!actor) return;

        console.log('Rendering Token HUD for token:', token.name);
        if (!hud._soundBoard || hud._soundBoard.id !== hud.object.id)
            hud._soundBoard = { id: hud.object.id, active: false };

        const folderPath = game.settings.get('voicegen', 'save-voice-folder');
        const tokenFolder = `${folderPath}/${token.name}`;
        console.log('Token folder path:', tokenFolder);

        // Check if the token folder exists, if not, create it
        try {
            const response = await FilePicker.browse('data', tokenFolder);
            console.log('Token folder exists:', tokenFolder);
        } catch (e) {
            if (e.message.includes("does not exist")) {
                await FilePicker.createDirectory('data', tokenFolder);
                console.log('Created token folder:', tokenFolder);
            } else {
                console.error('Error checking token folder:', e);
            }
        }

        let mp3Files = await getCachedMP3Metadata(tokenFolder, token.name);

        // Always append the buttons
        const button = $(`
            <div class="control-icon token-sounds" data-action="token-sounds" title="Token Sounds">
                <i class="fas fa-music"></i>
            </div>
        `);
        html.find('div.right').last().append(button);

        const refreshButton = $(`
            <div class="control-icon token-sounds-refresh" data-action="token-sounds-refresh" title="Refresh Token Sounds">
                <i class="fas fa-sync"></i>
            </div>
        `);
        html.find('div.right').last().append(refreshButton);

        button.click((event) => _onButtonClick(event, token, hud, mp3Files, tokenFolder, actor.type === 'character', html));
        refreshButton.click(async (event) => {
            mp3Files = await refreshMP3Metadata(tokenFolder, token.name);
            if (hud._soundBoard.active) {
                hud._soundBoard.active = false;
                button.removeClass('active');
                button.siblings('.token-sounds-wrapper').remove();
            }
        });

        if (mp3Files.length === 0) return;

        // Initialize recording setup
        initializeRecording(token, tokenFolder);

        // Observe the token-hud for style changes
        observeTokenHud();
    });
}

async function _onButtonClick(event, token, hud, mp3Files, tokenFolder, isCharacter, html) {
    const button = $(event.target).closest('.control-icon');
    button.toggleClass('active');
    hud._soundBoard.active = button.hasClass('active');

    let wrapper = button.siblings('.token-sounds-wrapper');
    if (button.hasClass('active')) {
        if (!wrapper.length) {
            wrapper = $('<div class="token-sounds-wrapper"></div>');
            button.after(wrapper);

            const configButton = $(`
                <div class="control-icon token-sound-config" data-action="token-sound-config" title="Token Sound Config">
                    <i class="fas fa-cog"></i>
                </div>
            `);
            wrapper.append(configButton);

            configButton.click((event) => _onConfigButtonClick(event, configButton));

            // Add event listeners to mode buttons
            $('input[name="state-d"]').on('change', function () {
                const mode = $(this).attr('id');
                console.log('Mode changed to:', mode); // Debugging log
                if (mode === 'fx') {
                    configButton.hide();
                } else {
                    configButton.show();
                }
            });

            // Set initial visibility of config button based on the current mode
            const initialMode = $('input[name="state-d"]:checked').attr('id');
            console.log('Initial mode:', initialMode); // Debugging log
            if (initialMode === 'fx') {
                configButton.hide();
            } else {
                configButton.show();
            }

            if (isCharacter) {
                createCharacterSoundUI(wrapper, token, tokenFolder, mp3Files);
            } else {
                await createNpcSoundUI(wrapper, token, tokenFolder, mp3Files);
            }
        }
        wrapper.addClass('active');
    } else {
        wrapper.removeClass('active');
    }
}

function _onConfigButtonClick(event, configButton) {
    const existingConfigWrapper = document.querySelector('.token-sound-config-wrapper');
    
    if (existingConfigWrapper) {
        const isWrapperVisible = existingConfigWrapper.style.display === 'block';
        configButton.toggleClass('active', !isWrapperVisible);
        existingConfigWrapper.style.display = isWrapperVisible ? 'none' : 'block';
    } else {
        const newConfigWrapper = $(`
            <div class="token-sound-config-wrapper" style="display: none; position: absolute;">
                <i class="fas fa-times close-config" style="position: absolute; top: 5px; right: 5px; font-size: 20px; cursor: pointer;"></i>
                <label for="stability">Stability</label>
                <input type="range" id="stability" name="stability" min="0.3" max="1" step="0.01" value="0.5">
                <span id="stability-value">0.5</span>

                <label for="similarity_boost">Similarity Boost</label>
                <input type="range" id="similarity_boost" name="similarity_boost" min="0.3" max="1" step="0.01" value="0.8">
                <span id="similarity-boost-value">0.8</span>
            </div>
        `);
        $('#interface').after(newConfigWrapper);

        newConfigWrapper.find('.close-config').click(() => {
            newConfigWrapper.hide();
            configButton.removeClass('active');
        });

        // Make the config wrapper draggable
        if (typeof $.ui !== 'undefined') {
            newConfigWrapper.draggable({
                containment: 'window'
            });
        } else {
            const script = document.createElement('script');
            script.src = 'https://code.jquery.com/ui/1.12.1/jquery-ui.min.js';
            script.onload = () => {
                newConfigWrapper.draggable({
                    containment: 'window'
                });
            };
            document.head.appendChild(script);
        }

        // Initialize the slider value display
        updateSliderValue('stability', 'stability-value');
        updateSliderValue('similarity_boost', 'similarity-boost-value');

        // Add event listeners for the sliders to update their values dynamically
        $('#stability').on('input', function() {
            updateSliderValue('stability', 'stability-value');
        });
        $('#similarity_boost').on('input', function() {
            updateSliderValue('similarity_boost', 'similarity-boost-value');
        });

        // Stop propagation for config wrapper and its children
        newConfigWrapper.on('click', function(event) {
            event.stopPropagation();
        });

        newConfigWrapper.show();
        configButton.addClass('active');
    }
}

// Function to update the displayed value of a slider
function updateSliderValue(sliderId, valueId) {
    const slider = document.getElementById(sliderId);
    const valueDisplay = document.getElementById(valueId);

    slider.addEventListener('input', () => {
        valueDisplay.textContent = slider.value;
    });
}

// Function to observe changes to the token-hud element
function observeTokenHud() {
    const tokenHud = document.getElementById('token-hud');
    if (!tokenHud) return;

    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.attributeName === 'style') {
                const style = window.getComputedStyle(tokenHud);
                if (style.display === 'none') {
                    deactivateConfigWrapper();
                }
            }
        });
    });

    observer.observe(tokenHud, { attributes: true, attributeFilter: ['style'] });
}

// Function to deactivate the token-sound-config-wrapper
function deactivateConfigWrapper() {
    const configWrapper = document.querySelector('.token-sound-config-wrapper');
    if (configWrapper) {
        $(configWrapper).hide();
        const configButton = document.querySelector('.control-icon.token-sound-config');
        if (configButton) {
            configButton.classList.remove('active');
        }
    }
}



function convertToMp3AndSave(audioBlob) {
    var reader = new FileReader();
    reader.onload = function (event) {
        var buffer = event.target.result;

        // Check the first few bytes for a valid WAV header
        var dataView = new DataView(buffer);
        var isValidWav = dataView.getUint32(0, false) === 0x52494646; // "RIFF" in ASCII
        if (!isValidWav) {
            console.error('Invalid WAV header.');
            return;
        }

        var wav = lamejs.WavHeader.readHeader(dataView);
        if (!wav) {
            console.error('WAV header could not be read.');
            return;
        }

        var samples = new Int16Array(buffer, wav.dataOffset, wav.dataLen / 2);
        var mp3enc = new lamejs.Mp3Encoder(1, wav.sampleRate, 128);
        var mp3Data = [];
        var sampleBlockSize = 1152;
        for (var i = 0; i < samples.length; i += sampleBlockSize) {
            var sampleChunk = samples.subarray(i, i + sampleBlockSize);
            var mp3buf = mp3enc.encodeBuffer(sampleChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(new Int8Array(mp3buf));
            }
        }
        var mp3buf = mp3enc.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
        }
        var mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
        saveMp3File(mp3Blob);
    };
    reader.readAsArrayBuffer(audioBlob);
}

function initializeRecording() {
    document.addEventListener("DOMContentLoaded", function () {
        microphoneButton = document.querySelector(".start-recording-button");
        stopRecordingButton = document.querySelector(".stop-recording-button");
        cancelRecordingButton = document.querySelector(".cancel-recording-button");
        elapsedTimeTag = document.querySelector(".elapsed-time");
        recordingControlButtonsContainer = document.querySelector(".recording-control-buttons-container");
        const audioElement = document.querySelector(".audio-element");
        audioElementSource = audioElement.getElementsByTagName("source")[0];

        if (microphoneButton) {
            microphoneButton.addEventListener("click", function (event) {
                event.stopPropagation();
                startAudioRecording();
            });
        }

        if (stopRecordingButton) stopRecordingButton.onclick = stopAudioRecording;
        if (cancelRecordingButton) cancelRecordingButton.onclick = cancelAudioRecording;
    });
}

function startAudioRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
            handleRecording(stream);
        })
        .catch(function (error) {
            console.error("Microphone access denied:", error);
            alert("Microphone access is required to record audio.");
        });
}

function handleRecording(stream) {
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); // Correct MIME type for audio
    const audioChunks = [];
    const sampleRate = 44100;
    const kbps = 128;
    let mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
    let mp3Data = [];

    mediaRecorder.addEventListener("dataavailable", event => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }
    });

    mediaRecorder.addEventListener("stop", async () => {
        console.log("Stopping Audio Recording...");

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();

        // Decode audio data to PCM format
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Convert PCM data to Int16Array for lamejs
        const pcmData = audioBuffer.getChannelData(0); // Assuming mono channel
        const samples = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            samples[i] = pcmData[i] * 32767;
        }

        // Encode to MP3
        const sampleBlockSize = 1152;
        for (let i = 0; i < samples.length; i += sampleBlockSize) {
            const sampleChunk = samples.subarray(i, i + sampleBlockSize);
            const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(new Int8Array(mp3buf));
            }
        }

        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
        }

        const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
        playAudio(mp3Blob);
        saveMp3File(mp3Blob, tokenFolder);

        // Stop all tracks to stop the microphone
        stream.getTracks().forEach(track => track.stop());
    });

    mediaRecorder.start();
    handleDisplayingRecordingControlButtons();

    stopRecordingButton.onclick = function () {
        mediaRecorder.stop();
        handleHidingRecordingControlButtons();
    };

    cancelRecordingButton.onclick = function () {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
        handleHidingRecordingControlButtons();
    };
}




function createCharacterSoundUI(wrapper, token, tokenFolder, mp3Files) {
    // Add input box and create button
    const createContainer = $(`
        <div class="create-container">
            <input type="text" class="create-input11" placeholder="Say what?">
            <button class="create-button11">Create Voice</button>
        </div>
    `);
    wrapper.append(createContainer);

    createContainer.find('.create-input11, .create-button11, .sound-icon, .voice-icon, .voice-icon:hover, .sound-icon:hover').on('click', (event) => {
        event.stopPropagation();
    });

    createContainer.find('.create-button11').click(() => {
        const lyrics = createContainer.find('.create-input11').val();
        if (lyrics) {
            game.modules.get('voicegen').api.Play_Sound_HUD(lyrics, token);
            createContainer.find('.create-input11').val('');
            deactivateTokenSoundsWrapper(wrapper);
        }
    });

    displayMp3Files(wrapper, token, tokenFolder, mp3Files, true, true);
}

async function createNpcSoundUI(wrapper, token, tokenFolder, mp3Files) {
    const voices = await game.modules.get('voicegen').api.Get_Voices();
    const voiceOptions = voices.map(voice => `<option value="${voice.voice_id}">${voice.name}</option>`).join('');

    // Add dropdown menu, input box, and create button
    const createContainer = $(`
        <div class="create-container">
            <select class="voice-select">${voiceOptions}</select>
            <input type="text" class="create-input11" placeholder="Say what?">
            <button class="create-button11">✔️</button>
        </div>
    `);
    wrapper.append(createContainer);

    createContainer.find('.voice-select, .create-input11, .create-button11, .sound-icon, .voice-icon, .voice-icon:hover, .sound-icon:hover').on('click', (event) => {
        event.stopPropagation();
    });

    createContainer.find('.create-button11').click(async () => {
        const selectedVoice = createContainer.find('.voice-select').val();
        const lyrics = createContainer.find('.create-input11').val();
        if (lyrics) {
            await game.modules.get('voicegen').api.Text_To_Speech(selectedVoice, lyrics, token.name);
            createContainer.find('.create-input11').val('');
            deactivateTokenSoundsWrapper(wrapper);
        }
    });

    displayMp3Files(wrapper, token, tokenFolder, mp3Files, false, true);
}

function displayMp3Files(wrapper, token, tokenFolder, mp3Files, isCharacter, keepWrapperInactive = false) {
    const switchHTML = `
    <div class="switch-toggle switch-3 switch-candy">
        <input id="fx" name="state-d" type="radio" />
        <label for="fx" onclick="">FX</label>

        <input id="all" name="state-d" type="radio" checked=""/>
        <label for="all" onclick="">ALL</label>

        <input id="vox" name="state-d" type="radio" />
        <label for="vox" onclick="">VOX</label>

        <a></a>
    </div>

    <div class="microphone-icon-container">
        <i class="start-recording-button fa fa-microphone" aria-hidden="true"></i>
    </div>
    <div class="recording-control-buttons-container hide">
        <i class="cancel-recording-button fa fa-times-circle-o" aria-hidden="true"></i>
        <div class="recording-elapsed-time">
            <i class="red-recording-dot fa fa-circle" aria-hidden="true"></i>
            <p class="elapsed-time"></p>
        </div>
        <i class="stop-recording-button fa fa-stop-circle-o" aria-hidden="true"></i>
    </div>
    <div class="overlay hide">
        <div class="browser-not-supporting-audio-recording-box">
            <p>To record audio, use browsers like Chrome and Firefox that support audio recording.</p>
            <button type="button" class="close-browser-not-supported-box">Ok.</button>
        </div>
    </div>
    <audio controls class="audio-element hide">
        <source src="">
    </audio>
    <div class="text-indication-of-audio-playing-container">
        <p class="text-indication-of-audio-playing hide">Audio is playing<span>.</span><span>.</span><span>.</span></p>
    </div>
`;


    wrapper.prepend(switchHTML);

    // Control the visibility of the token-sounds-wrapper based on the parameter
    if (keepWrapperInactive) {
        let tokenSoundsWrapper = wrapper.find('.token-sounds-wrapper');
        if (tokenSoundsWrapper.length) {
            tokenSoundsWrapper.removeClass('active');
        }
    }

    renderFilteredSounds('all', wrapper, token, tokenFolder, mp3Files, isCharacter);
    toggleFxForm('all', wrapper, token);
    $('input[name="state-d"]').change(function () {
        const selectedFilter = $('input[name="state-d"]:checked').attr('id');
        renderFilteredSounds(selectedFilter, wrapper, token, tokenFolder, mp3Files, isCharacter);
        toggleFxForm(selectedFilter, wrapper, token);
    });

    // Setup recording event listeners
    setupRecordingEventListeners(token, tokenFolder);
}

function setupRecordingEventListeners(token, tokenFolder) {
    var microphoneButton = document.querySelector(".start-recording-button");
    var recordingControlButtonsContainer = document.querySelector(".recording-control-buttons-container");
    var stopRecordingButton = document.querySelector(".stop-recording-button");
    var cancelRecordingButton = document.querySelector(".cancel-recording-button");
    var elapsedTimeTag = document.querySelector(".elapsed-time");
    var closeBrowserNotSupportedBoxButton = document.querySelector(".close-browser-not-supported-box");
    var overlay = document.querySelector(".overlay");
    var audioElement = document.querySelector(".audio-element");
    var audioElementSource = audioElement.getElementsByTagName("source")[0];
    var textIndicatorOfAudiPlaying = document.querySelector(".text-indication-of-audio-playing");

    var audioRecordStartTime;
    var elapsedTimeTimer;
    var mediaRecorder;

    if (microphoneButton) {
        microphoneButton.addEventListener("click", function (event) {
            event.stopPropagation();
            startAudioRecording();
        });
    }

    if (stopRecordingButton) stopRecordingButton.onclick = stopAudioRecording;
    if (cancelRecordingButton) cancelRecordingButton.onclick = cancelAudioRecording;
    if (closeBrowserNotSupportedBoxButton) closeBrowserNotSupportedBoxButton.onclick = hideBrowserNotSupportedOverlay;
    if (audioElement) audioElement.onended = hideTextIndicatorOfAudioPlaying;

    function startAudioRecording() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function (stream) {
                handleRecording(stream);
            })
            .catch(function (error) {
                console.error("Microphone access denied:", error);
                alert("Microphone access is required to record audio.");
            });
    }

    function stopAudioRecording() {
        console.log("Stopping Audio Recording...");

        mediaRecorder.stop()
            .then(audioAsBlob => {
                playAudio(audioAsBlob);
                handleHidingRecordingControlButtons();
            })
            .catch(error => {
                switch (error.name) {
                    case 'InvalidStateError':
                        console.log("An InvalidStateError has occurred.");
                        break;
                    default:
                        console.log("An error occurred with the error name " + error.name);
                }
            });
    }

    function cancelAudioRecording() {
        console.log("Canceling audio...");

        mediaRecorder.cancel();
        handleHidingRecordingControlButtons();
    }

    function handleRecording(stream) {
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); // Correct MIME type for audio
        const audioChunks = [];
        const sampleRate = 44100;
        const kbps = 128;
        let mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
        let mp3Data = [];

        mediaRecorder.addEventListener("dataavailable", event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        });

        mediaRecorder.addEventListener("stop", async () => {
            console.log("Stopping Audio Recording...");

            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const arrayBuffer = await audioBlob.arrayBuffer();

            // Decode audio data to PCM format
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Convert PCM data to Int16Array for lamejs
            const pcmData = audioBuffer.getChannelData(0); // Assuming mono channel
            const samples = new Int16Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
                samples[i] = pcmData[i] * 32767;
            }

            // Encode to MP3
            const sampleBlockSize = 1152;
            for (let i = 0; i < samples.length; i += sampleBlockSize) {
                const sampleChunk = samples.subarray(i, i + sampleBlockSize);
                const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(new Int8Array(mp3buf));
                }
            }

            const mp3buf = mp3encoder.flush();
            if (mp3buf.length > 0) {
                mp3Data.push(new Int8Array(mp3buf));
            }

            const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
            playAudio(mp3Blob);
            const filePath = await saveMp3File(mp3Blob, tokenFolder);
            await saveUpdatedLyrics(filePath, 'DELETED'); // Mark the file as deleted
            await game.modules.get('voicegen').api.transformSpeechToSpeech(filePath, token); // Transform the speech using ElevenLabs API

            // Stop all tracks to stop the microphone
            stream.getTracks().forEach(track => track.stop());
        });

        mediaRecorder.start();
        handleDisplayingRecordingControlButtons();

        stopRecordingButton.onclick = function () {
            mediaRecorder.stop();
            handleHidingRecordingControlButtons();
        };

        cancelRecordingButton.onclick = function () {
            mediaRecorder.stop();
            stream.getTracks().forEach(track => track.stop());
            handleHidingRecordingControlButtons();
        };
    }

    function playAudio(audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);
        audioElementSource.src = audioUrl;
        audioElement.load();
        audioElement.play();
    }

    async function saveMp3File(mp3Blob, tokenFolder) {
        const filename = generateRandomFilename() + ".mp3";
        const file = new File([mp3Blob], filename, { type: 'audio/mp3' });
    
        const response = await FilePicker.upload('data', tokenFolder, file, {});
        if (response.path) {
            console.log("Audio file saved successfully:", response.path);
            return response.path;
        } else {
            console.error("Failed to save audio file.");
            throw new Error("Failed to save audio file.");
        }
    }

    function generateRandomFilename() {
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var result = '';
        for (var i = 0; i < 8; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    function handleDisplayingRecordingControlButtons() {
        microphoneButton.style.display = "none";
        if (recordingControlButtonsContainer) recordingControlButtonsContainer.classList.remove("hide");
        handleElapsedRecordingTime();
    }

    function handleElapsedRecordingTime() {
        audioRecordStartTime = new Date();
        displayElapsedTimeDuringAudioRecording("00:00");

        elapsedTimeTimer = setInterval(function () {
            const elapsedTime = computeElapsedTime(audioRecordStartTime);
            displayElapsedTimeDuringAudioRecording(elapsedTime);
        }, 1000);
    }

    function handleHidingRecordingControlButtons() {
        microphoneButton.style.display = "block";
        if (recordingControlButtonsContainer) recordingControlButtonsContainer.classList.add("hide");
        clearInterval(elapsedTimeTimer);
    }

    function hideBrowserNotSupportedOverlay() {
        console.log("Hiding browser not supported overlay");
        if (overlay) overlay.classList.add("hide");
    }

    function computeElapsedTime(startTime) {
        const endTime = new Date();
        let timeDiff = endTime - startTime;
        timeDiff = timeDiff / 1000;
        const seconds = Math.floor(timeDiff % 60);
        const formattedSeconds = seconds < 10 ? "0" + seconds : seconds;
        timeDiff = Math.floor(timeDiff / 60);
        const minutes = timeDiff % 60;
        const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;
        timeDiff = Math.floor(timeDiff / 60);
        const hours = timeDiff % 24;
        const formattedHours = hours < 10 ? "0" + hours : hours;

        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    }

    function displayElapsedTimeDuringAudioRecording(elapsedTime) {
        if (elapsedTimeTag) elapsedTimeTag.innerHTML = elapsedTime;

        if (elapsedTimeReachedMaximumNumberOfHours(elapsedTime)) {
            stopAudioRecording();
        }
    }

    function elapsedTimeReachedMaximumNumberOfHours(elapsedTime) {
        var elapsedTimeSplitted = elapsedTime.split(":");
        var maximumRecordingTimeInHoursAsString = "01"; // Assuming 1 hour max

        if (elapsedTimeSplitted.length === 3 && elapsedTimeSplitted[0] === maximumRecordingTimeInHoursAsString)
            return true;
        else
            return false;
    }

    function hideTextIndicatorOfAudioPlaying() {
        if (textIndicatorOfAudiPlaying) textIndicatorOfAudiPlaying.classList.add("hide");
    }


}


function toggleFxForm(filter, wrapper, token) {
    // Handle FX form visibility
    wrapper.find('.fx-form').remove(); // Remove existing FX form if any

    if (filter === 'fx') {
        const fxFormHtml = `
            <div class="fx-form">
                <input type="text" id="fx-description" placeholder="Description" />
<input type="number" id="fx-duration" placeholder="Duration (sec)" min="1" max="10" style="color: white;" />
                <input type="text" id="fx-filename" placeholder="Filename" pattern="[A-Za-z0-9]+" />
                <button class="create-button11" onclick="createEffectFromForm('${token.id}')">Create Effect</button>
            </div>
        `;
        wrapper.find('.switch-toggle').after(fxFormHtml);
        $('#fx-description, #fx-duration, #fx-filename, #fx-create-button').on('click keydown', function(event) {
            event.stopPropagation();
        });
    }

    // Handle create container visibility based on VOX selection
    if (filter === 'vox') {
        wrapper.find('.create-container').show(); // Show the create container for VOX
    } else {
        wrapper.find('.create-container').hide(); // Hide it for others
    }
}

window.createEffectFromForm = function(tokenId) {
    const description = document.getElementById('fx-description').value.trim();
    const duration = parseInt(document.getElementById('fx-duration').value, 10);
    const filename = document.getElementById('fx-filename').value.trim().replace(/\W+/g, ''); // Removes non-alphanumeric characters

    if (!description || !filename || isNaN(duration)) {
        ui.notifications.error("Please fill all fields correctly.");
        return;
    }

    // Call Generate_Sound_Effect or your API logic here
    game.modules.get('voicegen').api.Generate_Sound_Effect(description, `${filename}.mp3`, duration);
};

function renderFilteredSounds(filter, wrapper, token, tokenFolder, mp3Files, isCharacter) {
    const visibleFiles = mp3Files.filter(file => {
        if (file.lyrics === 'DELETED') return false;
        if (filter === 'fx') return file.lyrics.toLowerCase().startsWith('effetto') || file.lyrics.toLowerCase().startsWith('effect');
        if (filter === 'vox') return !(file.lyrics.toLowerCase().startsWith('effetto') || file.lyrics.toLowerCase().startsWith('effect'));
        return true;  // 'all' or default case
    });

    // Clear previous icons and any "No Audio Found" messages
    wrapper.find('.sound-icon, .voice-icon, .no-audio').remove();
    const micIconContainer = wrapper.find('.microphone-icon-container');
    if (filter === 'fx') {
        micIconContainer.hide();
    } else {
        micIconContainer.show();
    }
    if (visibleFiles.length === 0) {
        displayNoAudioMessage(wrapper, token, isCharacter);
    } else {
        visibleFiles.forEach(file => {
            displaySoundIcon(wrapper, file, tokenFolder, mp3Files);
        });
    }
}

function displaySoundIcon(wrapper, file, tokenFolder, mp3Files) { // Ensure mp3Files is included in parameters
    const filePath = `${tokenFolder}/${file.name}`;
    const lyrics = file.lyrics;
    const isVoiceFile = lyrics.toLowerCase().startsWith('effetto') || lyrics.toLowerCase().startsWith('effect');
    const sparklesIcon = isVoiceFile ? '<i class="fas fa-sparkles"></i> ' : '';
    const soundIconClass = isVoiceFile ? 'voice-icon' : 'sound-icon';

    const icon = $(`
        <div class="${soundIconClass}" title="${lyrics}">
            <i class="fas fa-play"></i>
            <span>${sparklesIcon}${lyrics}</span>
            <span class="delete-icon"><i class="fas fa-times"></i></span>
        </div>
    `);

    setupIconEvents(icon, filePath, file, tokenFolder, mp3Files, wrapper);
    wrapper.append(icon);
}

function setupIconEvents(icon, filePath, file, tokenFolder, mp3Files, wrapper) {
    icon.find('.delete-icon').click(async (event) => {
        event.stopPropagation();
        await markFileAsDeleted(filePath, file, tokenFolder, mp3Files);
        icon.remove();
        checkForEmptyList(wrapper, mp3Files); // Ensure mp3Files is passed here
    });

    icon.click(() => {
        AudioHelper.play({ src: filePath, volume: 1, autoplay: true, loop: false }, true);
    });

    icon.contextmenu(() => {
        showEditDialog(filePath, file, tokenFolder, mp3Files);
    });
}

function checkForEmptyList(wrapper, mp3Files) { // Ensure mp3Files is included in parameters
    if (!wrapper.children('.sound-icon, .voice-icon').length) {
        displayNoAudioMessage(wrapper);
    }
}

function displayNoAudioMessage(wrapper, token, isCharacter) {
    let noAudioMessage = 'No Audio Found';
    // Additional logic to customize the message based on token and character status
    // Ensures that the message only appears once
    if (wrapper.children('.no-audio').length === 0) {
        wrapper.append(`<div class="no-audio">${noAudioMessage}</div>`);
    }
}



function showEditDialog(filePath, file, tokenFolder, mp3Files) {
    const currentLyrics = file.lyrics;

    new Dialog({
        title: "Edit Lyrics",
        content: `
            <div class="dialog-content">
                <label for="lyrics">Lyrics:</label>
                <input type="text" name="lyrics" value="${currentLyrics}" />
            </div>
        `,
        buttons: {
            save: {
                label: "Save",
                callback: async (html) => {
                    const newLyrics = html.find('input[name="lyrics"]').val();
                    file.lyrics = newLyrics;
                    await saveUpdatedLyrics(filePath, newLyrics);
                    await updateMP3MetadataCache(tokenFolder, mp3Files);
                }
            },
            cancel: {
                label: "Cancel"
            }
        },
        default: "save"
    }).render(true);
}

async function saveUpdatedFile(filePath, buffer) {
    const file = new File([buffer], filePath.split('/').pop(), { type: 'audio/mp3' });
    const response = await FilePicker.upload('data', filePath.substring(0, filePath.lastIndexOf('/')), file, {});
    if (response.path) {
        ui.notifications.notify("Lyrics updated successfully!");
    } else {
        ui.notifications.error("Failed to update lyrics.");
    }
}

async function saveUpdatedLyrics(filePath, newLyrics) {
    const buffer = await fetch(filePath).then(res => res.arrayBuffer());
    const mp3tag = new MP3Tag(buffer, true);
    mp3tag.read();
    if (!mp3tag.tags.v2) mp3tag.tags.v2 = {};
    mp3tag.tags.v2.USLT = [{
        language: 'eng',
        descriptor: '',
        text: newLyrics
    }];
    mp3tag.save();
    const updatedBuffer = mp3tag.buffer;
    await saveUpdatedFile(filePath, updatedBuffer);
}

async function markFileAsDeleted(filePath, file, tokenFolder, mp3Files) {
    file.lyrics = 'DELETED';
    await saveUpdatedLyrics(filePath, 'DELETED');
    await updateMP3MetadataCache(tokenFolder, mp3Files);
}

async function getCachedMP3Metadata(tokenFolder, tokenName) {
    const cacheKey = `mp3-metadata-${tokenName}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        return JSON.parse(cachedData);
    } else {
        const mp3Files = await fetchMP3Metadata(tokenFolder);
        localStorage.setItem(cacheKey, JSON.stringify(mp3Files));
        return mp3Files;
    }
}

async function fetchMP3Metadata(tokenFolder) {
    const response = await FilePicker.browse('data', tokenFolder, { extensions: ['.mp3'] });
    const mp3Files = [];
    if (response.files && response.files.length > 0) {
        for (const file of response.files.filter(f => f.endsWith('.mp3'))) {
            const filePath = `${tokenFolder}/${file.split('/').pop()}`;
            const buffer = await fetch(filePath).then(res => res.arrayBuffer());
            const mp3tag = new MP3Tag(buffer, true);
            mp3tag.read();

            const lyrics = mp3tag.tags.v2?.USLT?.[0]?.text || 'No lyrics';
            mp3Files.push({ name: file.split('/').pop(), lyrics });
        }
    }
    return mp3Files;
}

async function updateMP3MetadataCache(tokenFolder, mp3Files) {
    const cacheKey = `mp3-metadata-${tokenFolder.split('/').pop()}`;
    localStorage.setItem(cacheKey, JSON.stringify(mp3Files));
}

async function refreshMP3Metadata(tokenFolder, tokenName) {
    const mp3Files = await fetchMP3Metadata(tokenFolder);
    const cacheKey = `mp3-metadata-${tokenName}`;
    localStorage.setItem(cacheKey, JSON.stringify(mp3Files));
    ui.notifications.notify("MP3 metadata refreshed successfully!");
    return mp3Files;
}
