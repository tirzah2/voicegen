export function registerTokenHooks() {
  Hooks.on('renderTokenHUD', async (hud, html, token) => {
    const actor = game.actors.get(token.actorId);
    if (!actor || actor.type !== 'character') return;
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

    button.click((event) => _onButtonClick(event, token, hud, mp3Files, tokenFolder));
    refreshButton.click(async (event) => {
      mp3Files = await refreshMP3Metadata(tokenFolder, token.name);
      if (hud._soundBoard.active) {
        _onButtonClick(event, token, hud, mp3Files, tokenFolder);
      }
    });

    if (mp3Files.length === 0) return;
  });
}

async function _onButtonClick(event, token, hud, mp3Files, tokenFolder) {
  const button = $(event.target).closest('.control-icon');
  button.toggleClass('active');
  hud._soundBoard.active = button.hasClass('active');

  let wrapper = button.find('.token-sounds-wrapper');
  if (button.hasClass('active')) {
    if (!wrapper.length) {
      wrapper = $('<div class="token-sounds-wrapper"></div>');
      button.find('i').after(wrapper);

      // Add input box and create button
      const createContainer = $(`
        <div class="create-container">
          <input type="text" class="create-input11" placeholder="Che dici?">
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
          game.modules.get('voicegen').api.Play_Sound_HUD(lyrics, token.name);
          createContainer.find('.create-input11').val('');
        }
      });

      const visibleFiles = mp3Files.filter(file => file.lyrics !== 'DELETED');

      if (visibleFiles.length === 0) {
        wrapper.append('<div class="no-audio">Nessun Audio Trovato</div>');
      } else {
        for (const file of visibleFiles) {
          const filePath = `${tokenFolder}/${file.name}`;
          const lyrics = file.lyrics;

          const isVoiceFile = file.lyrics.toLowerCase().startsWith('effetto') || file.lyrics.toLowerCase().startsWith('effect');
          const sparklesIcon = isVoiceFile ? '<i class="fas fa-sparkles"></i> ' : '';
          const soundIconClass = isVoiceFile ? 'voice-icon' : 'sound-icon';

          const icon = $(`
            <div class="${soundIconClass}" title="${lyrics}">
              <i class="fas fa-play"></i>
              <span>${sparklesIcon}${lyrics}</span>
              <span class="delete-icon"><i class="fas fa-times"></i></span>
            </div>
          `);

          icon.find('.delete-icon').click(async (event) => {
            event.stopPropagation();
            await markFileAsDeleted(filePath, file, tokenFolder, mp3Files);
            icon.remove();
            if (!wrapper.children('.sound-icon').length) {
              wrapper.append('<div class="no-audio">No Audio Found</div>');
            }
          });

          icon.click(() => {
            AudioHelper.play({ src: filePath, volume: 1, autoplay: true, loop: false }, true);
          });

          icon.contextmenu(() => {
            showEditDialog(filePath, file, tokenFolder, mp3Files);
          });

          wrapper.append(icon);
        }
      }
    }
    wrapper.addClass('active');
  } else {
    wrapper.removeClass('active');
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
