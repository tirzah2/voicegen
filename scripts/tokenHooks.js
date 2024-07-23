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

        button.click((event) => _onButtonClick(event, token, hud, mp3Files, tokenFolder, actor.type === 'character'));
        refreshButton.click(async (event) => {
            mp3Files = await refreshMP3Metadata(tokenFolder, token.name);
            if (hud._soundBoard.active) {
                hud._soundBoard.active = false;
                button.removeClass('active');
                button.find('.token-sounds-wrapper').remove();
            }
        });

        if (mp3Files.length === 0) return;
    });
}

async function _onButtonClick(event, token, hud, mp3Files, tokenFolder, isCharacter) {
    const button = $(event.target).closest('.control-icon');
    button.toggleClass('active');
    hud._soundBoard.active = button.hasClass('active');

    let wrapper = button.find('.token-sounds-wrapper');
    if (button.hasClass('active')) {
        if (!wrapper.length) {
            wrapper = $('<div class="token-sounds-wrapper"></div>');
            button.find('i').after(wrapper);

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

function createCharacterSoundUI(wrapper, token, tokenFolder, mp3Files) {
    // Add input box and create button
    const createContainer = $(`
        <div class="create-container">
            <input type="text" class="create-input11" placeholder="Say what?">
            <button class="create-button11">✔️</button>
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
        }
    });

    displayMp3Files(wrapper, token, tokenFolder, mp3Files, true);
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
            const newMp3Files = await refreshMP3Metadata(tokenFolder, token.name);
            displayMp3Files(wrapper, token, tokenFolder, newMp3Files, false);
            createContainer.find('.create-input11').val('');
        }
    });

    displayMp3Files(wrapper, token, tokenFolder, mp3Files, false);
}

function displayMp3Files(wrapper, token, tokenFolder, mp3Files, isCharacter) {
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
    `;

    wrapper.prepend(switchHTML);

    // Initial filter and render
    renderFilteredSounds('all', wrapper, token, tokenFolder, mp3Files, isCharacter);

    // Event listener for switch
    $('input[name="state-d"]').change(function () {
        const selectedFilter = $('input[name="state-d"]:checked').attr('id');
        renderFilteredSounds(selectedFilter, wrapper, token, tokenFolder, mp3Files, isCharacter);
    });
}

function renderFilteredSounds(filter, wrapper, token, tokenFolder, mp3Files, isCharacter) {
    const visibleFiles = mp3Files.filter(file => {
        if (file.lyrics === 'DELETED') return false;
        if (filter === 'fx') return file.lyrics.toLowerCase().startsWith('effetto') || file.lyrics.toLowerCase().startsWith('effect');
        if (filter === 'vox') return !(file.lyrics.toLowerCase().startsWith('effetto') || file.lyrics.toLowerCase().startsWith('effect'));
        return true;  // 'all' or default case
    });

    // Clear previous icons and any "No Audio Found" messages
    wrapper.find('.sound-icon, .voice-icon, .no-audio').remove();

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
