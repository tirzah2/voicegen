import json

with open('releases.json', 'r') as file:
    releases = json.load(file)

changelog = ""
for release in releases:
    release_notes = release.get('body', '')
    release_tag = release.get('tag_name', '')
    changelog += f"## {release_tag}\n{release_notes}\n\n"

with open('changelog.txt', 'w') as file:
    file.write(changelog)
