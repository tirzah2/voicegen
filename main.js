var selected_api_key = "";
var all_Voices;
var subscriptionInfo;
var button;
var historyItems = [];

Hooks.once('init', () => {
    game.settings.register("voicegen", "xi-api-key", {
        name: "API Key",
        hint: "Your Elevenlabs API Key",
        scope: "client",
        config: true,
        type: String,
        default: "", // Ensure this setting defaults to an empty string
        onChange: value => { Initialize_Main() }
    });

    game.settings.register("voicegen", "save-effect-folder", {
        name: "Save Effect Folder",
        hint: "Select the folder where sound effects will be saved",
        scope: "client",
        config: true,
        type: String,
        default: "", // Ensure a sensible default
        filePicker: 'folder'  // This enables folder selection directly in the setting
    });

    game.settings.register("voicegen", "save-voice-folder", {
        name: "Save Voice Folder",
        hint: "Select the folder where voice files will be saved using the Play command",
        scope: "client",
        config: true,
        type: String,
        default: "", // Set a default path or leave it empty for users to select
        filePicker: 'folder'  // This enables folder selection directly in the setting
    });

    game.settings.register("voicegen", "selected-model", {
        name: "Selected Model",
        hint: "Choose your Elevenlabs model",
        scope: "client",
        config: true,
        type: String,
        choices: {
            "eleven_multilingual_v2": "Eleven Multilingual V2",
            "eleven_turbo_v2": "Eleven Turbo V2",
            "eleven_turbo_v2_5": "Eleven Turbo V2.5",
            "eleven_monolingual_v1": "Eleven Monolingual V1"
        },
        default: "eleven_multilingual_v2",
        onChange: value => { Initialize_Main(); updateForceLanguageVisibility(); }
    });

    game.settings.register("voicegen", "force-language", {
        name: "Force Language",
        hint: "Select the language code to force when using Eleven Turbo V2.5",
        scope: "client",
        config: true,
        type: String,
        choices: {
            "EN": "English",
            "JP": "🇯🇵 Japanese",
            "CN": "🇨🇳 Chinese",
            "DE": "🇩🇪 German",
            "IN": "🇮🇳 Hindi",
            "FR": "🇫🇷 French",
            "KR": "🇰🇷 Korean",
            "PT": "🇵🇹 Portuguese (Portugal)",
            "IT": "🇮🇹 Italian",
            "ES": "🇪🇸 Spanish (Spain)",
            "ID": "🇮🇩 Indonesian",
            "NL": "🇳🇱 Dutch",
            "TR": "🇹🇷 Turkish",
            "PH": "🇵🇭 Filipino",
            "PL": "🇵🇱 Polish",
            "SE": "🇸🇪 Swedish",
            "BG": "🇧🇬 Bulgarian",
            "RO": "🇷🇴 Romanian",
            "AE": "🇦🇪 Arabic (UAE)",
            "CZ": "🇨🇿 Czech",
            "GR": "🇬🇷 Greek",
            "FI": "🇫🇮 Finnish",
            "HR": "🇭🇷 Croatian",
            "MY": "🇲🇾 Malay",
            "SK": "🇸🇰 Slovak",
            "DK": "🇩🇰 Danish",
            "IN": "🇮🇳 Tamil",
            "UA": "🇺🇦 Ukrainian",
            "RU": "🇷🇺 Russian",
            "HU": "🇭🇺 Hungarian",
            "NO": "🇳🇴 Norwegian",
            "VN": "🇻🇳 Vietnamese"
        },
        default: "",
        onChange: value => { updateForceLanguageVisibility(); }
    });

    Initialize_Main();
    Hooks.on("renderSettingsConfig", updateForceLanguageVisibility);
});

function updateForceLanguageVisibility() {
    const selectedModel = game.settings.get("voicegen", "selected-model");
    const forceLanguageSetting = document.querySelector(`input[name="voicegen.force-language"]`)?.closest(".form-group");
    if (forceLanguageSetting) {
        if (selectedModel === "eleven_turbo_v2_5") {
            forceLanguageSetting.style.display = "block";
        } else {
            forceLanguageSetting.style.display = "none";
        }
    }
}

Hooks.once('setup', () => {
    game.modules.get('voicegen').api = {
        Initialize_Main,
        Get_Userdata,
        Play_Sound_HUD,
        Play_Sound,
        runPlaySound,
        Get_Voices,
        Text_To_Speech,
        Generate_Sound_Effect,
        getAmbientSoundOptions,
        saveFile,
        Fetch_History,
        Fetch_History_Audio,
        Show_History_Dialog,
        Voice_Field,
        Send_Text_To_Speech,
        doStuff,
        sleep,
        Create_Window,
        Set_Key,
        Set_Key_Window,
        Voice_Exists,
        transformSpeechToSpeech,
        getVoiceIdForToken,
        saveTransformedFile
    };
});

Hooks.on('chatMessage', (log, message) => { try { return Play_Sound(message) } catch { }; })
Hooks.on("ready", () => {
    game.socket.on('module.voicegen', ({ testarg, container }) => {
        runPlaySound(container)
    })
})

async function Initialize_Main() {
    selected_api_key = game.settings.get("voicegen", "xi-api-key");
    if (selected_api_key) {
        await Get_Voices();
        Get_Userdata();
    }
}

async function Get_Userdata() {
    subscriptionInfo = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        headers: {
            'accept': 'application/json',
            'xi-api-key': selected_api_key
        }
    }).then(response => response.text()).then(text => JSON.parse(text))
}

export function Play_Sound_HUD(lyrics, token) {
    if (selected_api_key) {
        // Check if a voice with the same name as the token exists
        let voice = all_Voices.find(obj => obj.name === token.name);

        // If no voice with the token's name exists, check for a voice tag
        if (!voice) {
            const tokenDocument = canvas.tokens.get(token._id); // Get the token document
            const tags = Tagger.getTags(tokenDocument);
            const voiceTag = tags.find(tag => tag.startsWith('voice:'));
            if (voiceTag) {
                const voiceName = voiceTag.split(':')[1];
                voice = all_Voices.find(obj => obj.name === voiceName);
                if (voice) {
                    ui.notifications.info(`Using tagged voice: ${voiceName}`);
                }
            }
        }

        if (voice) {
            Text_To_Speech(voice.voice_id, lyrics, token.name);
        } else {
            ui.notifications.error(`Voice for token '${token.name}' not found. Visit <a href="https://www.elevenlabs.io/" target="_blank">https://www.elevenlabs.io/</a> and create a voice named '${token.name}'. Also, remember to refresh both elevenlabs and foundry by pressing F5`);
        }
    } else {
        Set_Key_Window();
    }
}
export async function transformSpeechToSpeech(filePath, token) {
    const XI_API_KEY = game.settings.get("voicegen", "xi-api-key");
    const VOICE_ID = await getVoiceIdForToken(token);
    const sts_url = `https://api.elevenlabs.io/v1/speech-to-speech/${VOICE_ID}/stream`;

    const formData = new FormData();
    const response = await fetch(filePath);
    const blob = await response.blob();
    formData.append("audio", new Blob([blob], { type: 'audio/mp3' }));
    formData.append("model_id", "eleven_multilingual_sts_v2");

    // Get stability and similarity boost values
    const stabilityElement = document.getElementById('stability');
    const similarityBoostElement = document.getElementById('similarity_boost');
    
    const stability = stabilityElement ? parseFloat(stabilityElement.value) || 0.5 : 0.5;
    const similarityBoost = similarityBoostElement ? parseFloat(similarityBoostElement.value) || 0.8 : 0.8;
    
    

    // Validate the values
    const stabilityValid = stability >= 0.3 && stability <= 1;
    const similarityBoostValid = similarityBoost >= 0 && similarityBoost <= 1;

    // Construct voice settings
    const voiceSettings = {
        "style": 0.0,
        "use_speaker_boost": true
    };

    if (stabilityValid) {
        voiceSettings.stability = stability;
    }

    if (similarityBoostValid) {
        voiceSettings.similarity_boost = similarityBoost;
    }

    formData.append("voice_settings", JSON.stringify(voiceSettings));

    // Log the form data before sending
    for (let pair of formData.entries()) {
        console.log(`${pair[0]}: ${pair[1]}`);
    }

    const responseStream = await fetch(sts_url, {
        method: 'POST',
        headers: {
            "xi-api-key": XI_API_KEY
        },
        body: formData
    });

    if (responseStream.ok) {
        const transformedBlob = await responseStream.blob();
        const transformedFileName = filePath.replace('.mp3', '_transformed.mp3');
        await saveTransformedFile(transformedBlob, transformedFileName);
        console.log("Transformed audio saved successfully:", transformedFileName);
    } else {
        console.error("Failed to transform audio:", await responseStream.text());
    }
}



export async function getVoiceIdForToken(token) {
    let voice;

    const actor = game.actors.get(token.actorId);

    if (actor && actor.type === 'npc') {
        // Get the voice name from the dropdown for NPCs
        const voiceDropdown = document.querySelector('.voice-select');
        const voiceId = voiceDropdown.value;
        voice = all_Voices.find(obj => obj.voice_id === voiceId);
    } else {
        // Check if a voice with the same name as the token exists
        voice = all_Voices.find(obj => obj.name === token.name);
        
        if (!voice) {
            const tokenDocument = canvas.tokens.get(token._id); // Get the token document
            const tags = Tagger.getTags(tokenDocument);
            const voiceTag = tags.find(tag => tag.startsWith('voice:'));
            if (voiceTag) {
                const voiceName = voiceTag.split(':')[1];
                voice = all_Voices.find(obj => obj.name === voiceName);
                if (voice) {
                    ui.notifications.info(`Using tagged voice: ${voiceName}`);
                }
            }
        }
    }

    if (voice) {
        return voice.voice_id;
    } else {
        ui.notifications.error(`Voice for token '${token.name}' not found. Visit <a href="https://www.elevenlabs.io/" target="_blank">https://www.elevenlabs.io/</a> and create a voice named '${token.name}'. Also, remember to refresh both elevenlabs and foundry by pressing F5`);
        throw new Error(`Voice for token '${token.name}' not found.`);
    }
}



export async function saveTransformedFile(blob, filePath) {
    const file = new File([blob], filePath.split('/').pop(), { type: "audio/mpeg" });
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));

    try {
        const response = await FilePicker.upload("data", dir, file, {}, { notify: true });
        console.log("File upload response:", response);
        ui.notifications.info(`File saved: ${filePath}`);
    } catch (err) {
        console.error("Error saving file:", err);
        ui.notifications.error(`Failed to save file: ${filePath}`);
    }
}

function Play_Sound(message) {
    if (message.startsWith("/playsound")) {
        if (selected_api_key) {
            let voiceName = message.substring(message.indexOf("[") + 1, message.indexOf("]"));
            let text = message.substring(message.indexOf("]") + 1).trim(); // This is the description text

            let voice = all_Voices.find(obj => obj.name === voiceName);
            if (voice) {
                Text_To_Speech(voice.voice_id, text, voiceName);  // Pass the text as both the TTS input and as the description for the ID3 tags
            } else {
                ui.notifications.error(`Voice '${voiceName}' not found.`);
            }
        } else {
            Set_Key_Window();
        }
        return false;
    } else if (message.startsWith("/play")) {
        if (selected_api_key) {
            doStuff();
        } else {
            Set_Key_Window();
        }
        return false;
    } else if (message.startsWith("/effect")) {
        if (selected_api_key) {
            let effectParams = message.match(/\[([^\]]+)\]\s*(\((\d+)\))?\s*([^\s]+)$/);
            if (effectParams) {
                let effectDescription = effectParams[1];
                let duration = effectParams[3] ? parseInt(effectParams[3], 10) : 3; // Default to 3 seconds if not specified
                let filename = effectParams[4];
                Generate_Sound_Effect(effectDescription, filename, duration);
            } else {
                ui.notifications.error("Invalid command format. Use /effect [description] (duration) filename.ext");
            }
        } else {
            Set_Key_Window();
        }
        return false;
    } else if (message.startsWith("/history")) {
        Fetch_History();
        return false;
    }
}

async function runPlaySound(chunks) {
    let blob = new Blob(chunks, { type: 'audio/mpeg' })
    let url = window.URL.createObjectURL(blob)
    AudioHelper.play({ src: url, volume: 1.0, loop: false }, false)
}

async function Get_Voices() {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
            'accept': 'application/json',
            'xi-api-key': selected_api_key
        }
    });

    if (!response.ok) {
        console.error(`Error: ${response.statusText}`);
        return [];
    }

    const data = await response.json();
    all_Voices = data.voices;
    return all_Voices;
}

async function Generate_Sound_Effect(effectDescription, filename, duration = 3) {
    let savePath;

    // Extract the filename without the extension for lyric embedding
    let filenameNoExt = filename.replace(/\.[^/.]+$/, "");

    // Determine the appropriate save path based on token selection
    const selectedToken = canvas.tokens.controlled[0];
    if (selectedToken) {
        const saveBasePath = game.settings.get("voicegen", "save-voice-folder");
        savePath = `${saveBasePath}/${selectedToken.name}`;
    } else {
        savePath = game.settings.get("voicegen", "save-effect-folder");
    }

    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': selected_api_key
        },
        body: JSON.stringify({
            "text": effectDescription,
            "duration_seconds": duration,
            "prompt_influence": 0.3
        })
    });

    if (!response.ok) {
        console.error(`Error: ${response.statusText}`);
        return;
    }

    // Read the response as a blob and convert to ArrayBuffer for manipulation
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Embed the lyric "Effect: filename" into the MP3 tags
    let modifiedBuffer = await embedLyrics(arrayBuffer, `Effect: ${filenameNoExt}`);

    // Save the modified MP3 file to the specified directory
    saveFile(new Uint8Array(modifiedBuffer), `${savePath}/${filename}`);

    // Optionally, prompt the user to create an ambient sound with this file
    if (game.user.isGM) {
        new Dialog({
            title: "Create Ambient Sound",
            content: `<p>Do you want to create the sound on the scene?</p>`,
            buttons: {
                yes: {
                    label: "Yes",
                    callback: async () => {
                        let options = await getAmbientSoundOptions(`${savePath}/${filename}`);
                        const location = await warpgate.crosshairs.show({
                            size: 1,
                            label: "Select Sound Location",
                            tag: 'sound'
                        });
                        options.x = location.x;
                        options.y = location.y;
                        canvas.scene.createEmbeddedDocuments("AmbientSound", [options]);
                    }
                },
                no: {
                    label: "No",
                    callback: () => {}
                }
            }
        }).render(true);
    }
}

async function getAmbientSoundOptions(path) {
    return new Promise((resolve) => {
        new Dialog({
            title: "Ambient Sound Options",
            content: `
                <form>
                    <div class="form-group">
                        <label>Path:</label>
                        <input type="text" name="path" value="${path}" readonly/>
                    </div>
                    <div class="form-group">
                        <label>Radius:</label>
                        <input type="number" name="radius" value="20"/>
                    </div>
                    <div class="form-group">
                        <label>Volume:</label>
                        <input type="number" name="volume" value="1" step="0.01" min="0" max="1"/>
                    </div>
                    <div class="form-group">
                        <label>Flags:</label>
                        <input type="text" name="flags" value=""/>
                    </div>
                    <div class="form-group">
                        <label>Repeat:</label>
                        <input type="checkbox" name="repeat" value="true"/>
                    </div>
                </form>
            `,
            buttons: {
                ok: {
                    label: "OK",
                    callback: (html) => {
                        const path = html.find('input[name="path"]').val();
                        const radius = parseInt(html.find('input[name="radius"]').val(), 10);
                        const volume = parseFloat(html.find('input[name="volume"]').val());
                        const flags = html.find('input[name="flags"]').val();
                        const repeat = html.find('input[name="repeat"]').is(':checked');
                        resolve({ path, radius, volume, flags, repeat });
                    }
                }
            }
        }).render(true);
    });
}

async function Text_To_Speech(voiceID, text, tokenName) {
    const selectedModel = game.settings.get("voicegen", "selected-model");
    const requestBody = {
        "text": text,  // This is the spoken text
        "model_id": selectedModel  // Use the selected model
    };

    if (selectedModel === "eleven_turbo_v2_5") {
        const selectedLanguage = game.settings.get("voicegen", "force-language");
        if (selectedLanguage) {
            requestBody.language_code = selectedLanguage.toLowerCase();
        }
    }

    try {
        let container = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceID}`, {
            method: 'POST',
            headers: {
                'accept': 'audio/mpeg',
                'xi-api-key': selected_api_key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!container.ok) {
            const errorText = await container.text();
            throw new Error(`Error ${container.status}: ${errorText}`);
        }

        let responseBlob = await container.blob();
        let arrayBuffer = await responseBlob.arrayBuffer();

        // Embedding ID3 Tags with the text as lyrics
        let modifiedBuffer = await embedLyrics(arrayBuffer, text);  // Pass ArrayBuffer directly

        const baseSavePath = game.settings.get("voicegen", "save-voice-folder");
        const voiceFolder = `${baseSavePath}/${tokenName.replace(/[\W_]+/g, "_")}`;
        const filename = `Voice-${Date.now()}.mp3`;

        saveFile(new Uint8Array(modifiedBuffer), `${voiceFolder}/${filename}`, true);
    } catch (error) {
        console.error('Error in Text_To_Speech:', error);
        ui.notifications.error(`Failed to generate speech: ${error.message}`);
    }
}



async function embedLyrics(arrayBuffer, description) {
    try {
        const mp3tag = new MP3Tag(arrayBuffer, true);
        mp3tag.read();

        if (mp3tag.error !== '') {
            console.error('Error processing MP3 tags:', mp3tag.error);
            return arrayBuffer;
        }

        if (!mp3tag.tags.v2) {
            mp3tag.tags.v2 = {};
        }

        mp3tag.tags.v2.USLT = [{
            language: 'eng',
            descriptor: '',
            text: description
        }];

        mp3tag.save();

        if (mp3tag.error) {
            console.error('Error saving MP3 tags:', mp3tag.error);
            return arrayBuffer;
        }

        return mp3tag.buffer;
    } catch (error) {
        console.error('Error embedding lyrics:', error);
        return arrayBuffer;
    }
}

async function saveFile(data, path, createSubDir = false) {
    let dir = path.substring(0, path.lastIndexOf('/'));

    // Check if a subdirectory needs to be created
    if (createSubDir) {
        await FilePicker.browse('data', dir).catch(async err => {
            if (err.message === "The requested path is not currently available.") {
                await FilePicker.createDirectory('data', dir, { notify: false });
            }
        });
    }

    const file = new File([data], path.split('/').pop(), { type: "audio/mpeg" });

    try {
        const response = await FilePicker.upload("data", dir, file, {}, { notify: true });
        console.log("File upload response:", response);
        ui.notifications.info(`File saved: ${path}`);
    } catch (err) {
        console.error("Error saving file:", err);
        ui.notifications.error(`Failed to save file: ${path}`);
    }
}

async function Fetch_History() {
    historyItems = []; // Initialize as an empty array
    const response = await fetch('https://api.elevenlabs.io/v1/history', {
        method: 'GET',
        headers: {
            'accept': 'application/json',
            'xi-api-key': selected_api_key
        }
    });

    if (!response.ok) {
        console.error(`Error: ${response.statusText}`);
        return;
    }

    const data = await response.json();
    historyItems = data.history;

    Show_History_Dialog();
}

async function Fetch_History_Audio(history_item_id) {
    const response = await fetch(`https://api.elevenlabs.io/v1/history/${history_item_id}/audio`, {
        method: 'GET',
        headers: {
            'xi-api-key': selected_api_key
        }
    });

    if (!response.ok) {
        console.error(`Error: ${response.statusText}`);
        return;
    }

    const reader = response.body.getReader();
    let chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    const url = window.URL.createObjectURL(blob);
    AudioHelper.play({ src: url, volume: 1.0, loop: false }, false);
}

function Show_History_Dialog() {
    let historyContent = `<table style="width:100%"><tr><th>Actor</th><th>Text</th><th>Play</th></tr>`;
    historyItems.forEach(item => {
        historyContent += `<tr><td>${item.voice_name}</td><td>${item.text}</td><td><button onclick="window.PlayHistoryItem('${item.history_item_id}')">Play</button></td></tr>`;
    });
    historyContent += `</table>`;

    new Dialog({
        title: `Sound History`,
        content: historyContent,
        buttons: {
            close: {
                label: "Close",
                callback: () => {}
            }
        }
    }).render(true);
}

window.PlayHistoryItem = async function(history_item_id) {
    Fetch_History_Audio(history_item_id);
}

async function Voice_Field() {
    if (!all_Voices || !all_Voices.length) {
        await Get_Voices();  // Ensure voices are loaded
    }

    let allVoices_Voice_Field = "<select name=\"allVoices_Voice_Field\" id=\"allVoices_Voice_Field\">"
    for (let i = (all_Voices.length - 1); i > 0; i--) {
        allVoices_Voice_Field += `<option value=${all_Voices[i].voice_id}>${all_Voices[i].name}</option>`
    }
    allVoices_Voice_Field += "</select>"

    let value = await new Promise((resolve) => {
        new Dialog({
            title: `Send Audio`,
            content: `<table style="width:100%"><tr><th style="width:50%">${allVoices_Voice_Field}</th><td style="width:50%"><input type="text" id="Voice_Field_Input" name="input"/></td></tr></table>`
                + `<td>${subscriptionInfo.character_count}/${subscriptionInfo.character_limit}</td>`
                + `<button id="Voice_Field_Get_Params">Send</button>`,
            buttons: {

            }
        }).render(true);
    });
    return [voiceID, voiceText];
}

function Send_Text_To_Speech() {
    voiceText = document.getElementById("Voice_Field_Input").value
    document.getElementById("Voice_Field_Input").value = ""
    let select = document.getElementById("allVoices_Voice_Field");
    voiceID = select.options[select.selectedIndex].value;
    Text_To_Speech(voiceID, voiceText)
}

async function doStuff() {
    await Create_Window();
    await sleep(20)
    button = document.getElementById("Voice_Field_Get_Params");
    button.addEventListener("click", () => { Send_Text_To_Speech() })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function Create_Window() {
    let split = await Voice_Field();
    let voice = split[0]
    let text = split[1]
    Text_To_Speech(voice, text)
}

async function Set_Key() {
    let value = await new Promise((resolve) => {
        new Dialog({
            title: `Set Elevenlabs Key`,
            content: `<table style="width:100%"><tr><th style="width:50%">"Set Your Key"</th><td style="width:50%"><input type="text" name="input"/></td></tr></table>`,
            buttons: {
                Ok: {
                    label: `Send`, callback: (html) => {
                        resolve(html.find("input").val());
                    }
                },
            }
        }).render(true);
    });
    return value;
}

async function Set_Key_Window() {
    let new_key = await Set_Key();
    if (new_key) {
        await game.settings.set("voicegen", "xi-api-key", new_key.trim());
        selected_api_key = new_key.trim();
        Initialize_Main();
    }
}

function Voice_Exists(voiceName) {
    return all_Voices && all_Voices.some(voice => voice.name === voiceName);
}
