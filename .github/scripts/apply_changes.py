import json,os,shutil,datetime

def apply_changes():
    if not os.path.exists('changes.json'):
        print("No changes.json found.")
        return
    with open('changes.json','r',encoding='utf-8') as f:
        data=json.load(f)
    changes=data['changes'] if isinstance(data,dict) and 'changes' in data else data
    if not changes:
        print("Empty.")
        return
    applied=0
    errors=[]
    for i,c in enumerate(changes):
        fp=c.get('file')
        # Si no hay 'action' pero hay 'find'+'replace', asumir replace
        action=c.get('action') or c.get('type') or ('replace' if 'find' in c else None)
        try:
            if action=='replace':
                if not os.path.exists(fp):
                    errors.append(f"[{i}] Not found: {fp}"); continue
                with open(fp,'r',encoding='utf-8') as f: content=f.read()
                find=c.get('find') or c.get('old','')
                replace=c.get('replace') or c.get('new','')
                if find not in content:
                    errors.append(f"[{i}] String not found in {fp}: {repr(find[:80])}"); continue
                content=content.replace(find,replace,1)
                with open(fp,'w',encoding='utf-8') as f: f.write(content)
                print(f"[{i}] ok replace {fp}"); applied+=1
            elif action=='create':
                d=os.path.dirname(fp)
                if d: os.makedirs(d,exist_ok=True)
                with open(fp,'w',encoding='utf-8') as f: f.write(c.get('content',''))
                print(f"[{i}] ok create {fp}"); applied+=1
            elif action=='delete':
                if os.path.exists(fp): os.remove(fp)
                print(f"[{i}] ok delete {fp}"); applied+=1
            elif action=='append':
                with open(fp,'a',encoding='utf-8') as f: f.write(c.get('content',''))
                print(f"[{i}] ok append {fp}"); applied+=1
            else:
                errors.append(f"[{i}] Unknown action: {action}")
        except Exception as e:
            errors.append(f"[{i}] Error {fp}: {e}")
    if applied>0:
        os.makedirs('changes_history',exist_ok=True)
        ts=datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        shutil.copy('changes.json',f'changes_history/changes_{ts}.json')
        with open('changes.json','w') as f: json.dump([],f)
    print(f"\nApplied: {applied}/{len(changes)}")
    if errors:
        for e in errors: print(e)
        if applied==0: exit(1)

if __name__=='__main__': apply_changes()
