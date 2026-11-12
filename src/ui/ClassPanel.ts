import { cloud, ApiError, type SyncState } from '../net/Cloud';
import { save } from '../core/Save';
import { audio } from '../core/Audio';
import { buildPanel, button, closeOverlay, el, mountOverlay } from './overlay';

/**
 * Joining a teacher's class, and keeping progress safe.
 *
 * Three views in one panel: join (a class code and a nickname, or a student code to come back on another
 * device), the code shown once after joining, and the class status with save, load and leave. Every sentence is
 * written for a twelve-year-old. A student is only ever asked for a nickname: never a real name or an email.
 */

const STATE_TEXT: Record<SyncState, string> = {
  off: 'Not saving to the cloud.',
  synced: 'Saved to the cloud.',
  saving: 'Saving…',
  offline: 'Could not reach the server. Your progress is safe on this device and will save when it is back.',
  'newer-in-cloud': 'A newer save is in the cloud, from another device.',
};

export interface ClassPanelOptions {
  /** Called after joining or leaving, so the game can fetch the class's questions. */
  onChange?: () => void;
}

export function presentClassPanel(opts: ClassPanelOptions = {}): void {
  const { panel, body, foot } = buildPanel({ title: 'My class', subtitle: 'Optional: your teacher can see how you are getting on', width: 'narrow', closable: true });
  panel.classList.add('cls');
  let unsubscribe = (): void => undefined;
  const close = (): void => {
    unsubscribe();
    closeOverlay();
  };
  mountOverlay('class', panel, { onEscape: close });
  (panel.querySelector('.close-x') as HTMLButtonElement).onclick = close;

  const message = (text: string, kind: 'info' | 'bad' | 'good' = 'info'): HTMLElement => {
    const p = el('p', `cls-msg cls-${kind}`, text);
    p.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
    return p;
  };
  const field = (label: string, input: HTMLInputElement, hint?: string): HTMLElement => {
    const wrap = el('label', 'cls-field');
    wrap.append(el('span', undefined, label), input);
    if (hint) wrap.append(el('small', undefined, hint));
    return wrap;
  };
  const input = (placeholder: string, max: number, mono = false): HTMLInputElement => {
    const i = el('input', mono ? 'cls-input mono' : 'cls-input') as HTMLInputElement;
    i.placeholder = placeholder;
    i.maxLength = max;
    i.autocomplete = 'off';
    i.spellcheck = false;
    return i;
  };
  const busy = (b: HTMLButtonElement, on: boolean, label: string): void => {
    b.disabled = on;
    b.textContent = on ? 'Please wait…' : label;
  };

  const show = (): void => {
    unsubscribe();
    body.replaceChildren();
    foot.replaceChildren();
    const m = cloud.membership;
    if (m) return showStatus();
    showJoin();
  };

  // ---------------------------------------------------------------------- join
  const showJoin = (): void => {
    body.append(
      el('p', 'cls-lead', 'If your teacher gave you a class code, join here. Your teacher will see your progress, and your progress will be saved so you can pick it up on any device.'),
    );
    const code = input('Class code, like K7M2QX', 8, true);
    const nick = input('A nickname, not your real name', 20);
    const status = el('div');
    const join = button('Join class', 'btn btn-primary');
    body.append(field('Class code', code), field('Nickname', nick, 'Use 2 to 20 letters or numbers. Pick something your teacher will recognise.'), status, join);

    join.addEventListener('click', async () => {
      status.replaceChildren();
      if (code.value.trim().length < 6) return void status.append(message('Type the 6 letters and numbers of your class code.', 'bad'));
      if (nick.value.trim().length < 2) return void status.append(message('Type a nickname.', 'bad'));
      busy(join, true, 'Join class');
      try {
        const info = await cloud.classInfo(code.value);
        await cloud.join(info.code, nick.value);
        audio.success();
        opts.onChange?.();
        showCode();
      } catch (e) {
        status.append(message(e instanceof ApiError ? e.message : 'Could not reach the server. Check your connection and try again.', 'bad'));
      } finally {
        busy(join, false, 'Join class');
      }
    });

    // Coming back on another device.
    const back = el('details', 'cls-back');
    back.append(el('summary', undefined, 'I already joined, on another device'));
    const mine = input('Your student code, like K7M2-QX4D-9HPT', 16, true);
    const restoreStatus = el('div');
    const restore = button('Bring my progress back', 'btn btn-ghost');
    back.append(field('Student code', mine, 'It was shown to you when you joined.'), restoreStatus, restore);
    body.append(back);
    restore.addEventListener('click', async () => {
      restoreStatus.replaceChildren();
      busy(restore, true, 'Bring my progress back');
      try {
        await cloud.restore(mine.value);
        opts.onChange?.();
        const saved = await cloud.pull();
        if (saved) return offerLoad(saved.clientUpdatedAt);
        show();
      } catch (e) {
        restoreStatus.append(message(e instanceof ApiError ? e.message : 'Could not reach the server.', 'bad'));
      } finally {
        busy(restore, false, 'Bring my progress back');
      }
    });
    const later = button('Not now', 'btn btn-ghost');
    later.addEventListener('click', close);
    foot.append(later);
  };

  // ----------------------------------------------------------------- the code
  const showCode = (): void => {
    body.replaceChildren();
    foot.replaceChildren();
    const m = cloud.membership;
    if (!m) return show();
    body.append(
      el('p', 'cls-lead', `You are in ${m.className}, as ${m.nickname}.`),
      el('p', 'cls-lead', 'This is your student code. It is the only way to get your progress back on another device or after clearing your browser.'),
    );
    const big = el('div', 'cls-code', m.studentCode);
    big.setAttribute('aria-label', `Your student code is ${m.studentCode.split('').join(' ')}`);
    const copy = button('Copy code', 'btn btn-ghost');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(m.studentCode);
        copy.textContent = 'Copied ✓';
      } catch {
        copy.textContent = 'Select the code and copy it';
      }
    });
    body.append(big, copy, message('Write it down somewhere safe. We cannot look it up for you, and nobody else needs it.', 'info'));
    const done = button('I have written it down', 'btn btn-primary');
    done.addEventListener('click', () => {
      void cloud.push(save.profile);
      show();
    });
    foot.append(done);
  };

  // ------------------------------------------------------------- newer save
  const offerLoad = (clientUpdatedAt: number): void => {
    body.replaceChildren();
    foot.replaceChildren();
    const when = new Date(clientUpdatedAt).toLocaleString();
    body.append(
      el('p', 'cls-lead', `There is saved progress in the cloud, from ${when}.`),
      el('p', 'cls-lead', save.hasProgress ? 'This device also has progress. Loading the cloud copy replaces the one on this device.' : 'Load it to carry on where you left off.'),
    );
    const load = button('Load cloud progress', 'btn btn-primary');
    const keep = button(save.hasProgress ? 'Keep this device’s' : 'Not now', 'btn btn-ghost');
    load.addEventListener('click', () => void loadFromCloud(load));
    keep.addEventListener('click', show);
    foot.append(keep, load);
  };

  const loadFromCloud = async (b: HTMLButtonElement): Promise<void> => {
    busy(b, true, 'Load cloud progress');
    try {
      const saved = await cloud.pull();
      if (!saved) return void show();
      save.replaceProfile(saved.profile);
      // The world was built from the old save: starting again from the new one is the simple, safe way.
      window.location.reload();
    } catch {
      busy(b, false, 'Load cloud progress');
      body.append(message('Could not load it. Try again in a moment.', 'bad'));
    }
  };

  // -------------------------------------------------------------------- status
  const showStatus = (): void => {
    const m = cloud.membership;
    if (!m) return show();
    body.append(
      el('p', 'cls-lead', `You are in ${m.className}, as ${m.nickname}.`),
      el('p', 'cls-lead', 'Your teacher can see your progress: what you have done, and which topics need more practice. They cannot see anything else about you.'),
    );
    const state = el('p', 'cls-state');
    const paint = (): void => {
      state.textContent = STATE_TEXT[cloud.state];
      state.dataset.state = cloud.state;
    };
    paint();
    unsubscribe = cloud.onChange(paint);
    const code = el('div', 'cls-codeline');
    code.append(el('span', undefined, 'Student code'), el('b', 'cls-code small', m.studentCode));
    body.append(state, code);

    const saveNow = button('Save now', 'btn btn-ghost');
    saveNow.addEventListener('click', async () => {
      busy(saveNow, true, 'Save now');
      await cloud.push(save.profile);
      busy(saveNow, false, 'Save now');
    });
    const load = button('Load cloud progress', 'btn btn-ghost');
    load.addEventListener('click', async () => {
      busy(load, true, 'Load cloud progress');
      try {
        const saved = await cloud.pull();
        if (!saved) body.append(message('Nothing is saved in the cloud yet.', 'info'));
        else offerLoad(saved.clientUpdatedAt);
      } catch {
        body.append(message('Could not reach the server.', 'bad'));
      } finally {
        busy(load, false, 'Load cloud progress');
      }
    });
    const useThis = button('Use this device’s progress', 'btn btn-ghost');
    if (cloud.state === 'newer-in-cloud') {
      body.append(message('Another device has played since. Choose which progress to keep.', 'info'));
      useThis.addEventListener('click', async () => {
        await cloud.push(save.profile, { force: true });
        show();
      });
      foot.append(useThis);
    }
    const leave = button('Leave class', 'btn btn-ghost cls-danger');
    leave.addEventListener('click', () => {
      body.append(message('Leaving erases your saved progress from the cloud. Your progress on this device stays.', 'info'));
      const sure = button('Yes, leave and erase', 'btn btn-primary cls-danger');
      sure.addEventListener('click', async () => {
        await cloud.leave();
        opts.onChange?.();
        show();
      });
      leave.replaceWith(sure);
    });
    foot.append(leave, saveNow, load);
  };

  // Is there a server at all? Say so plainly rather than showing a form that cannot work.
  void (async () => {
    if (cloud.membership || (await cloud.available())) return show();
    body.replaceChildren();
    body.append(
      el('p', 'cls-lead', 'Classes need a connection to your teacher’s server, and this copy of the game cannot reach one.'),
      message('You can keep playing exactly as normal. Your progress is saved on this device.', 'info'),
    );
    const ok = button('Close', 'btn btn-primary');
    ok.addEventListener('click', close);
    foot.append(ok);
  })();
  body.append(el('p', 'cls-lead', 'Checking for your class…'));
}
