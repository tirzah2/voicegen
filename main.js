var api_keys = [];
var selected_api_key = "";
var all_Voices;
var answer;
var isKeyOwner = false;
var allowKeySharing = false;
var voiceID;
var voiceText;
var subscriptionInfo;
var button;
var historyItems = [];

Hooks.once('init', () => {
    game.settings.register("voicegen", "xi-api-keys", {
        name: "API Keys",
        hint: "Your Elevenlabs API Keys (comma-separated), we suggest not to use more than one API key (in particular if you are using free api keys) as it's against ToS to use more than API key, check T&C of Elevenlabs if it's allowed to use multiple paid API keys",
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
        default: "audiocollection/effects", // Ensure a sensible default
        filePicker: 'folder'  // This enables folder selection directly in the setting
    });
    
    

    game.settings.register("voicegen", "selected-api-key", {
        name: "Selected API Key",
        hint: "Choose your active API Key",
        scope: "client",
        config: true,
        type: String,
        choices: () => {
            let keys = game.settings.get("voicegen", "xi-api-keys") || "";
            let keysArray = keys.split(",");
            let choices = {};
            keysArray.forEach((key, index) => {
                choices[key.trim()] = `API Key ${index + 1}`;
            });
            return choices;
        },
        onChange: value => { Initialize_Main() }
    });

    game.settings.register("voicegen", "save-voice-folder", {
        name: "Save Voice Folder",
        hint: "Select the folder where voice files will be saved using the Play command",
        scope: "client",
        config: true,
        type: String,
        default: "audiocollection", // Set a default path or leave it empty for users to select
        filePicker: 'folder'  // This enables folder selection directly in the setting
    });

    Initialize_Main();
})

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
        Set_Key_Window
    };
});

Hooks.on('chatMessage', (log, message) => { try { return Play_Sound(message) } catch { }; })
Hooks.on("ready", () => {
    game.socket.on('module.voicegen', ({ testarg, container }) => {
        runPlaySound(container)
    })
})

async function Initialize_Main() {
    let keys = game.settings.get("voicegen", "xi-api-keys") || "";
    api_keys = keys.split(",").map(key => key.trim()).filter(key => key);
    selected_api_key = game.settings.get("voicegen", "selected-api-key");
    if (selected_api_key) {
        Get_Voices()
        Get_Userdata()
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
export function Play_Sound_HUD(lyrics, tokenName) {
    if (selected_api_key) {
      let voice = all_Voices.voices.find(obj => obj.name === tokenName);
      if (voice) {
        Text_To_Speech(voice.voice_id, lyrics);
      } else {
        ui.notifications.error(`Voice for token '${tokenName}' not found.`);
      }
    } else {
      Set_Key_Window();
    }
  }
  function Play_Sound(message) {
    if (message.startsWith("/playsound")) {
      if (selected_api_key) {
        let voiceName = message.substring(message.indexOf("[") + 1, message.indexOf("]"));
        let text = message.substring(message.indexOf("]") + 1).trim(); // This is the description text
  
        let voice = all_Voices.voices.find(obj => obj.name === voiceName);
        if (voice) {
          Text_To_Speech(voice.voice_id, text);  // Pass the text as both the TTS input and as the description for the ID3 tags
        } else {
          ui.notifications.error(`Voice '${voiceName}' not found.`);
        }
      } else {
        Set_Key_Window();
      }
      return false;
    } else if (message.startsWith("/play")) {
      if (selected_api_key) {
        doStuff()
      } else {
        Set_Key_Window()
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
        Set_Key_Window()
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
    await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
            'accept': 'application/json',
            'xi-api-key': selected_api_key
        }
    }).then(response => response.text()).
        then(text => all_Voices = JSON.parse(text))
}



async function Generate_Sound_Effect(effectDescription, filename, duration = 3) {
    let savePath;
  
    // Check if there is a selected token
    const selectedToken = canvas.tokens.controlled[0];
    if (selectedToken) {
      // Use the save-voice-folder when a token is selected
      const saveBasePath = game.settings.get("voicegen", "save-voice-folder");
      savePath = `${saveBasePath}/${selectedToken.name}`;
    } else {
      // Use the save-effect-folder when no token is selected
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
        "duration_seconds": duration,  // Optional, default value
        "prompt_influence": 0.3  // Optional, default value
      })
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
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    saveFile(buffer, `${savePath}/${filename}`);
  
    // Show the dialog to create the AmbientSound using the path from settings
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
              callback: () => { }
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

async function Text_To_Speech(voiceID, text) {
    let container = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceID, {
        method: 'POST',
        headers: {
            'accept': 'audio/mpeg',
            'xi-api-key': selected_api_key,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "text": text,  // This is the spoken text
            "model_id": "eleven_multilingual_v2"
        })
    });

    let responseBlob = await container.blob();
    let arrayBuffer = await responseBlob.arrayBuffer();

    // Embedding ID3 Tags with the text as lyrics
    let modifiedBuffer = await embedLyrics(arrayBuffer, text);  // Pass ArrayBuffer directly

    let voiceName = all_Voices.voices.find(v => v.voice_id === voiceID)?.name || 'Unknown';
    const baseSavePath = game.settings.get("voicegen", "save-voice-folder");
    const voiceFolder = `${baseSavePath}/${voiceName.replace(/[\W_]+/g, "_")}`;
    const filename = `Voice-${Date.now()}.mp3`;

    saveFile(new Uint8Array(modifiedBuffer), `${voiceFolder}/${filename}`, true);
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
    for (let key of api_keys) {
        const response = await fetch('https://api.elevenlabs.io/v1/history', {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'xi-api-key': key
            }
        });

        if (!response.ok) {
            console.error(`Error: ${response.statusText}`);
            continue;
        }

        const data = await response.json();
        historyItems = historyItems.concat(data.history);
    }

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
    let allVoices_Voice_Field = "<select name=\"allVoices_Voice_Field\" id=\"allVoices_Voice_Field\">"
    for (let i = (all_Voices.voices.length - 1); i > 0; i--) {
        allVoices_Voice_Field += `<option value=${all_Voices.voices[i].voice_id}>${all_Voices.voices[i].name}</option>`
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
    Create_Window()
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
        let keys = game.settings.get("voicegen", "xi-api-keys") || "";
        keys = keys.split(",").map(key => key.trim()).filter(key => key); // Ensure keys are trimmed and filtered
        keys.push(new_key.trim());
        await game.settings.set("voicegen", "xi-api-keys", keys.join(","));
        await game.settings.set("voicegen", "selected-api-key", new_key.trim());
        Initialize_Main();
    }
}
