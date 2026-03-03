"""
SCS Change Applier
Reads changes.json and applies them to the specified files.

changes.json format:
[
  {
    "file": "index.html",
    "action": "replace",
    "find": "exact string to find",
    "replace": "replacement string"
  },
  {
    "file": "esquemas/cialdini.html",
    "action": "create",
    "content": "full file content"
  }
]
"""
import json, os, shutil

def apply_changes():
    if not os.path.exists('changes.json'):
        print("No changes.json found, nothing to do.")
        return

    with open('changes.json', 'r', encoding='utf-8') as f:
        changes = json.load(f)

    applied = 0
    errors = []

    for i, change in enumerate(changes):
        file_path = change.get('file')
        action = change.get('action')

        try:
            if action == 'replace':
                if not os.path.exists(file_path):
                    errors.append(f"[{i}] File not found: {file_path}")
                    continue
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                find = change.get('find', '')
                replace = change.get('replace', '')
                if find not in content:
                    errors.append(f"[{i}] String not found in {file_path}: {find[:60]}...")
                    continue
                content = content.replace(find, replace, 1)
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"[{i}] ✓ replace in {file_path}")
                applied += 1

            elif action == 'create':
                os.makedirs(os.path.dirname(file_path) if os.path.dirname(file_path) else '.', exist_ok=True)
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(change.get('content', ''))
                print(f"[{i}] ✓ created {file_path}")
                applied += 1

            elif action == 'delete':
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"[{i}] ✓ deleted {file_path}")
                applied += 1

            elif action == 'append':
                with open(file_path, 'a', encoding='utf-8') as f:
                    f.write(change.get('content', ''))
                print(f"[{i}] ✓ appended to {file_path}")
                applied += 1

            else:
                errors.append(f"[{i}] Unknown action: {action}")

        except Exception as e:
            errors.append(f"[{i}] Error in {file_path}: {str(e)}")

    # Archive changes.json after applying
    if applied > 0:
        os.makedirs('changes_history', exist_ok=True)
        import datetime
        ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        shutil.copy('changes.json', f'changes_history/changes_{ts}.json')
        # Reset changes.json to empty array
        with open('changes.json', 'w') as f:
            json.dump([], f)

    print(f"\n✓ Applied: {applied} / {len(changes)}")
    if errors:
        print(f"✗ Errors ({len(errors)}):")
        for e in errors:
            print(f"  {e}")
        if applied == 0:
            exit(1)

if __name__ == '__main__':
    apply_changes()
