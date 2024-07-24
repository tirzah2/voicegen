
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/D1D210UKH9)  

# VoiceGen Module

VoiceGen is a Foundry VTT V11 module that allows Game Masters (GMs) and players (they need to have permissions to create files and browse files) to generate and manage sounds, including speech and sound effects, associated with tokens on the map. The module integrates with the ElevenLabs API to generate and play audio effects and manage them efficiently within the game.


https://github.com/user-attachments/assets/7d23617f-b520-49f6-b288-8736f3a57b6f



## Required Modules:
- Tagger
- Warpgate

## Free Subscription Requirement
This module requires integration with the ElevenLabs API https://elevenlabs.io/ to function properly. To use this module, you must have at least a free subscription to ElevenLabs. The subscription allows you to obtain the necessary API keys to access the service. Please visit the ElevenLabs Subscription Page to sign up for a subscription and to learn more about the different tiers available. Ensure that you properly configure your API keys in the module settings to enable full functionality. 

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Features](#features)
   - [Token Voices](#token-voices)
   - [Token Effects](#token-effects)
   - [Token Voices for NPC](#token-npc) 
   - [History](#history)
   - [API](#api)
   - [Change Description](#change-description)
4. [Functions](#functions)
5. [Usage](#usage)
   - [Creating Token Voices](#creating-token-voices)
   - [Creating Token Effects](#creating-token-effects)
   - [Managing Sounds](#managing-sounds)
   - [Playing Sounds](#playing-sounds)
   - [Editing Description](#editing-description)
6. [Changelog](#changelog)
7. [License](#license)
8. [Credits](#credits) 

## Installation

1. Download the module from the Foundry VTT module repository.
2. Place the module in the `modules` directory of your Foundry VTT installation.
3. Activate the module from the `Manage Modules` menu in Foundry VTT.

## Configuration

Before using VoiceGen, you need to configure a few settings:

1. **API Key**: Set your ElevenLabs API key.
2. **Save Voice Folder**: Configure the folder where voice files will be saved.
3. **Save Effect Folder**: Configure the folder where sound effect files will be saved.

To configure these settings:
1. Go to the `Settings` tab in Foundry VTT.
2. Click on `Configure Settings`.
3. Select `Module Settings`.
4. Locate `VoiceGen` and set the required configurations.
<br>
<img src="screenshots/Screenshot_3.png" alt="Screenshot 3" width="50%">
## Features

### Token Voices
VoiceGen allows you to generate and manage voices associated with tokens on the map. This includes playing sounds (through HUD) , generating speech (through HUD), and editing sound details (right click on sound description). If the token name has a voice in elevenlabs with the same name, it will automatically assign it to that token. Unless you want a different voice name, then use Tagger module to add the tag voice:voicename to the token.
<br>


https://github.com/user-attachments/assets/dc4b66fb-f701-4efe-8aa4-49c829604b48



### Token Effects
Select a token to which you want to add an effect, in the chat write /effect [description] (duration) filename.mp3
example: /effect [the sound of a man suffering] (4) suffering.mp3
NOW PART OF THE HUD
Generate sound effects associated with specific tokens, saving them in a designated folder. If a token is selected, the effect will be saved in a subfolder named after the token.
(easter egg: if you change the description to something that start with "effect" the button will become green)

### Scene Effects
/effect [a chant of witches in the forest] (10) suffering.mp3
By writing a command like this, it will create it inside the effect folder (make sure a token is not selected or it will create it in the token folder).
After the creation, it will ask you if you want to place it on the scene and guide you with a config dialog and a crosshair for placement.

### Token Voices for NPC
When you right click on a npc you will have a list of all your voices and you can use anyone to create a speech. 

### History
command /history
Maintain a history of generated sounds for easy reference and playback.
<br>
  <img src="screenshots/Screenshot_2.png" alt="Screenshot 1" width="20%">

## Usage

### Creating Token Voices

To create a token voice, use the `/playsound` command followed by the voice name in square brackets and the text:

```
/playsound [voiceName] Text to generate
```

Alternatively, you can use the HUD to generate token voices:

1. Select the token.
2. Click on the sound icon in the token HUD.
3. Enter the text in the input box and click "Create".

# Note
If you select a token and create a voice sound, remember that you need to have a voice with the same name of the token in Elevenlabs.io. The module will try to save that voice in a subfolder named like the token. It's good practice to re-create those folders in advance. 
If you don't want to name an elevenlabs voice like one of your token, you can use tagger to tag the token and choose a different voice using the formato voice:voicename
this works only on pc tokens. 
example: Otto doesn't have a voicename called Otto on elevenlabs, but i want to assign him a voice called Sam. I tag Otto with voice:Sam


### Creating Token Effects

To create a token effect, use the `/effect` command followed by the description, optional duration in parentheses, and the filename:

```
/effect [description] (duration) filename.ext
```

If a token is selected, the effect will be saved in a subfolder named after the token.

### Managing Sounds

- **Generating Sound Effects**: Use the `/effect` command to generate sound effects.
- **Editing Description**: Right-click on a sound icon in the HUD to "Edit Description".

### Playing Sounds

- Click on the play icon next to a sound to play it.
- Use the `/playsound` command to play sounds with specific voices and texts.

### Editing Lyrics

To edit the lyrics of a sound:
1. Right-click on the sound icon.
2. Select "Edit Lyrics".
3. Enter the new lyrics and save.

### History

Fetch and manage the history of generated sounds:

- Use the `/history` command to fetch the history of generated sounds.

### API

VoiceGen provides an API for programmatic interaction with the module. You can access the API functions using `game.modules.get('aedifs-token-sounds').api`.

**Available API functions**:
- `Initialize_Main`
- `Get_Userdata`
- `Play_Sound_HUD`
- `Play_Sound`
- `runPlaySound`
- `Get_Voices`
- `Text_To_Speech`
- `Generate_Sound_Effect`
- `getAmbientSoundOptions`
- `saveFile`
- `Fetch_History`
- `Fetch_History_Audio`
- `Show_History_Dialog`
- `Voice_Field`
- `Send_Text_To_Speech`
- `doStuff`
- `sleep`
- `Create_Window`
- `Set_Key`
- `Set_Key_Window`

## Changelog

<!-- changelog-start -->
## 2.2
**Full Changelog**: https://github.com/tirzah2/voicegen/compare/2.1.1...2.2

## 2.1.1
**Full Changelog**: https://github.com/tirzah2/voicegen/compare/2.1...2.1.1

## 2.1
**Full Changelog**: https://github.com/tirzah2/voicegen/compare/2...2.1

now player's character tokens don't have to use a  voice named like them in elevenlabs. If voicegen doesnt find a voice named  like yoru token, you can add a tag on the token in this format voice:voicename for example voice:Bill (Bill being a voice name in elevenlabs)

## 2
**Full Changelog**: https://github.com/tirzah2/voicegen/compare/1.9.1...2

Added NPC voices (create voices using any of the available voices, imported, cloned, community, etc). You dont have to stick to the same voice, you can change it everytime.

## 1.9.1
## What's Changed
* Test by @tirzah2 in https://github.com/tirzah2/voicegen/pull/1

## New Contributors
* @tirzah2 made their first contribution in https://github.com/tirzah2/voicegen/pull/1

**Full Changelog**: https://github.com/tirzah2/voicegen/compare/1.9...1.9.1

## 1.9
**Full Changelog**: https://github.com/tirzah2/voicegen/compare/1.8.2...1.9

## 1.8.2
**Full Changelog**: https://github.com/tirzah2/voicegen/compare/1.8.1...1.8.2

## 1.8.1


## 1.8
**Full Changelog**: https://github.com/tirzah2/voicegen/compare/1.7...1.8

## 1.7
<!-- changelog-end -->


## License

This module is licensed under the MIT License.

## Credits

For inspiration, a big thank you to Aedif's sound of token and Elevenlabs.io module by Vexthecollector
