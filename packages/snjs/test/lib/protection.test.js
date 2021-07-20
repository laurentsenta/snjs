import { ChallengeValidation, ChallengeValue, ChallengeReason } from '@Lib/challenges';
import { Uuid } from '@Lib/uuid';
import * as Factory from '../factory';

describe.skip('protections', function () {
  jest.setTimeout(Factory.TestTimeout);

  let application;

  afterEach(function () {
    application.deinit();
  });

  it('prompts for password when accessing protected note', async function () {
    let challengePrompts = 0;

    application = Factory.createApplication(Factory.randomString());
    const password = Uuid.GenerateUuidSynchronously();
    await application.prepareForLaunch({
      receiveChallenge: (challenge) => {
        challengePrompts += 1;
        expect(
          challenge.prompts.find(
            (prompt) =>
              prompt.validation === ChallengeValidation.AccountPassword
          )
        ).toBeTruthy();
        const values = challenge.prompts.map(
          (prompt) =>
            new ChallengeValue(
              prompt,
              prompt.validation === ChallengeValidation.AccountPassword
                ? password
                : 0
            )
        );

        application.submitValuesForChallenge(challenge, values);
      },
    });
    await application.launch(true);
    await Factory.registerUserToApplication({
      application: application,
      email: Uuid.GenerateUuidSynchronously(),
      password,
    });

    let note = await Factory.createMappedNote(application);
    note = await application.protectNote(note);

    expect(await application.authorizeNoteAccess(note)).toBe(true);
    expect(challengePrompts).toBe(1);
  });

  it('sets `note.protected` to true', async function () {
    application = await Factory.createInitAppWithRandNamespace();
    let note = await Factory.createMappedNote(application);
    note = await application.protectNote(note);
    expect(note.protected).toBe(true);
  });

  it('prompts for passcode when accessing protected note', async function () {
    const passcode = 'passcode🌂';
    let challengePrompts = 0;

    application = Factory.createApplication(Factory.randomString());
    await application.prepareForLaunch({
      receiveChallenge: (challenge) => {
        challengePrompts += 1;
        expect(
          challenge.prompts.find(
            (prompt) => prompt.validation === ChallengeValidation.LocalPasscode
          )
        ).toBeTruthy();
        const values = challenge.prompts.map(
          (prompt) =>
            new ChallengeValue(
              prompt,
              prompt.validation === ChallengeValidation.LocalPasscode
                ? passcode
                : 0
            )
        );

        application.submitValuesForChallenge(challenge, values);
      },
    });
    await application.launch(true);

    await application.addPasscode(passcode);
    let note = await Factory.createMappedNote(application);
    note = await application.protectNote(note);

    expect(await application.authorizeNoteAccess(note)).toBe(true);
    expect(challengePrompts).toBe(1);
  });

  it('prompts for passcode when unprotecting a note', async function () {
    const passcode = 'passcode🌂';
    let challengePrompts = 0;

    application = Factory.createApplication(Factory.randomString());
    await application.prepareForLaunch({
      receiveChallenge: (challenge) => {
        challengePrompts += 1;
        expect(
          challenge.prompts.find(
            (prompt) => prompt.validation === ChallengeValidation.LocalPasscode
          )
        ).toBeTruthy();
        const values = challenge.prompts.map(
          (prompt) =>
            new ChallengeValue(
              prompt,
              prompt.validation === ChallengeValidation.LocalPasscode
                ? passcode
                : 0
            )
        );

        application.submitValuesForChallenge(challenge, values);
      },
    });
    await application.launch(true);

    await application.addPasscode(passcode);
    let note = await Factory.createMappedNote(application);
    const uuid = note.uuid;
    note = await application.protectNote(note);
    note = await application.unprotectNote(note);
    expect(note.uuid).toBe(uuid);
    expect(note.protected).toBe(false);
    expect(challengePrompts).toBe(1);
  });

  it('does not unprotect note if challenge is canceled', async function () {
    const passcode = 'passcode🌂';
    let challengePrompts = 0;

    application = Factory.createApplication(Factory.randomString());
    await application.prepareForLaunch({
      receiveChallenge: (challenge) => {
        challengePrompts++;
        application.cancelChallenge(challenge);
      },
    });
    await application.launch(true);

    await application.addPasscode(passcode);
    let note = await Factory.createMappedNote(application);
    note = await application.protectNote(note);
    const result = await application.unprotectNote(note);
    expect(result).toBeUndefined();
    expect(challengePrompts).toBe(1);
  });

  it('does not prompt for passcode again after setting a remember duration', async function () {
    const passcode = 'passcode🌂';

    let challengePrompts = 0;
    application = Factory.createApplication(Factory.randomString());
    await application.prepareForLaunch({
      receiveChallenge: (challenge) => {
        challengePrompts += 1;
        expect(
          challenge.prompts.find(
            (prompt) => prompt.validation === ChallengeValidation.LocalPasscode
          )
        ).toBeTruthy();
        const values = challenge.prompts.map(
          (prompt) =>
            new ChallengeValue(
              prompt,
              prompt.validation === ChallengeValidation.LocalPasscode
                ? passcode
                : 3600
            )
        );

        application.submitValuesForChallenge(challenge, values);
      },
    });
    await application.launch(true);

    await application.addPasscode(passcode);
    let note = await Factory.createMappedNote(application);
    note = await application.protectNote(note);

    expect(await application.authorizeNoteAccess(note)).toBe(true);
    expect(await application.authorizeNoteAccess(note)).toBe(true);
    expect(challengePrompts).toBe(1);
  });

  it('prompts for password when adding a passcode', async function () {
    application = await Factory.createInitAppWithRandNamespace();
    const password = Uuid.GenerateUuidSynchronously();
    await Factory.registerUserToApplication({
      application: application,
      email: Uuid.GenerateUuidSynchronously(),
      password,
    });
    const promise = new Promise((resolve, reject) => {
      application.setLaunchCallback({
        receiveChallenge(challenge) {
          if (
            challenge.reason === ChallengeReason.AddPasscode &&
            challenge.prompts[0].validation ===
              ChallengeValidation.AccountPassword
          ) {
            resolve();
          } else {
            reject(Error('Received unknown challenge.'));
          }
        },
      });
    });
    application.addPasscode('passcode');
    return promise;
  });

  it('authorizes note access when no password or passcode are set', async function () {
    application = await Factory.createInitAppWithRandNamespace();

    let note = await Factory.createMappedNote(application);
    note = await application.protectNote(note);

    expect(await application.authorizeNoteAccess(note)).toBe(true);
  });

  it('authorizes autolock interval change', async function () {
    const passcode = 'passcode🌂';

    application = Factory.createApplication(Factory.randomString());
    await application.prepareForLaunch({
      receiveChallenge: (challenge) => {
        expect(
          challenge.prompts.find(
            (prompt) => prompt.validation === ChallengeValidation.LocalPasscode
          )
        ).toBeTruthy();
        const values = challenge.prompts.map(
          (prompt) =>
            new ChallengeValue(
              prompt,
              prompt.validation === ChallengeValidation.LocalPasscode
                ? passcode
                : 0
            )
        );

        application.submitValuesForChallenge(challenge, values);
      },
    });
    await application.launch(true);

    await application.addPasscode(passcode);

    expect(await application.authorizeAutolockIntervalChange()).toBe(true);
  });

  it('authorizes batch manager access', async function () {
    const passcode = 'passcode🌂';

    application = Factory.createApplication(Factory.randomString());
    await application.prepareForLaunch({
      receiveChallenge: (challenge) => {
        expect(
          challenge.prompts.find(
            (prompt) => prompt.validation === ChallengeValidation.LocalPasscode
          )
        ).toBeTruthy();
        const values = challenge.prompts.map(
          (prompt) =>
            new ChallengeValue(
              prompt,
              prompt.validation === ChallengeValidation.LocalPasscode
                ? passcode
                : 0
            )
        );

        application.submitValuesForChallenge(challenge, values);
      },
    });
    await application.launch(true);

    await application.addPasscode(passcode);

    expect(await application.authorizeAutolockIntervalChange()).toBe(true);
  });

  it('handles session length', async function () {
    application = await Factory.createInitAppWithRandNamespace();
    await application.protectionService.setSessionLength(300);
    const length = await application.protectionService.getSessionLength();
    expect(length).toBe(300);
    const expirey = application.getProtectionSessionExpiryDate();
    expect(expirey).toBeTruthy();
  });

  it('handles session length', async function () {
    application = await Factory.createInitAppWithRandNamespace();
    await application.protectionService.setSessionLength(300);
    const length = await application.protectionService.getSessionLength();
    expect(length).toBe(300);
    const expirey = application.getProtectionSessionExpiryDate();
    expect(expirey).toBeTruthy();
  });

  describe('hasProtectionSources', function () {
    it('no account, no passcode, no biometrics', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      expect(application.hasProtectionSources()).toBe(false);
    });

    it('no account, no passcode, biometrics', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      await application.enableBiometrics();
      expect(application.hasProtectionSources()).toBe(true);
    });

    it('no account, passcode, no biometrics', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      await application.addPasscode('passcode');
      expect(application.hasProtectionSources()).toBe(true);
    });

    it('no account, passcode, biometrics', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      await application.addPasscode('passcode');
      await application.enableBiometrics();
      expect(application.hasProtectionSources()).toBe(true);
    });

    it('account, no passcode, no biometrics', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      await Factory.registerUserToApplication({
        application: application,
        email: Uuid.GenerateUuidSynchronously(),
        password: Uuid.GenerateUuidSynchronously(),
      });
      expect(application.hasProtectionSources()).toBe(true);
    });

    it('account, no passcode, biometrics', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      await Factory.registerUserToApplication({
        application: application,
        email: Uuid.GenerateUuidSynchronously(),
        password: Uuid.GenerateUuidSynchronously(),
      });
      await application.enableBiometrics();
      expect(application.hasProtectionSources()).toBe(true);
    });

    it('account, passcode, no biometrics', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      const password = Uuid.GenerateUuidSynchronously();
      await Factory.registerUserToApplication({
        application: application,
        email: Uuid.GenerateUuidSynchronously(),
        password,
      });
      Factory.handlePasswordChallenges(application, password);
      await application.addPasscode('passcode');
      expect(application.hasProtectionSources()).toBe(true);
    });

    it('account, passcode, biometrics', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      const password = Uuid.GenerateUuidSynchronously();
      await Factory.registerUserToApplication({
        application: application,
        email: Uuid.GenerateUuidSynchronously(),
        password,
      });
      Factory.handlePasswordChallenges(application, password);
      await application.addPasscode('passcode');
      await application.enableBiometrics();
      expect(application.hasProtectionSources()).toBe(true);
    });
  });

  describe('areProtectionsEnabled', function () {
    it('should return true when session length has not been set', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      await application.addPasscode('passcode');
      expect(application.areProtectionsEnabled()).toBe(true);
    });

    it('should return false when session length has been set', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      await application.addPasscode('passcode');
      await application.protectionService.setSessionLength(300);
      expect(application.areProtectionsEnabled()).toBe(false);
    });

    it('should return false when there are no protection sources', async function () {
      application = await Factory.createInitAppWithRandNamespace();
      expect(application.areProtectionsEnabled()).toBe(false);
    });
  });

  describe('authorizeProtectedActionForNotes', function () {
    it('prompts for password once with the right challenge reason when one or more notes are protected', async function () {
      let challengePrompts = 0;
      application = Factory.createApplication(Factory.randomString());
      const password = Uuid.GenerateUuidSynchronously();

      await application.prepareForLaunch({
        receiveChallenge: (challenge) => {
          challengePrompts += 1;
          expect(
            challenge.prompts.find(
              (prompt) =>
                prompt.validation === ChallengeValidation.AccountPassword
            )
          ).toBeTruthy();
          expect(challenge.reason).toBe(ChallengeReason.SelectProtectedNote);
          const values = challenge.prompts.map(
            (prompt) =>
              new ChallengeValue(
                prompt,
                prompt.validation === ChallengeValidation.AccountPassword
                  ? password
                  : 0
              )
          );
          application.submitValuesForChallenge(challenge, values);
        },
      });
      await application.launch(true);
      await Factory.registerUserToApplication({
        application: application,
        email: Uuid.GenerateUuidSynchronously(),
        password,
      });

      const NOTE_COUNT = 3;
      let notes = await Factory.createManyMappedNotes(application, NOTE_COUNT);

      notes[0] = await application.protectNote(notes[0]);
      notes[1] = await application.protectNote(notes[1]);

      expect(await application.authorizeProtectedActionForNotes(
        notes,
        ChallengeReason.SelectProtectedNote
      )).toHaveLength(NOTE_COUNT);
      expect(challengePrompts).toBe(1);
    });

    it('prompts for passcode once with the right challenge reason when one or more notes are protected', async function () {
      let challengePrompts = 0;
      application = Factory.createApplication(Factory.randomString());
      const passcode = 'passcode🌂';

      await application.prepareForLaunch({
        receiveChallenge: (challenge) => {
          challengePrompts += 1;
          expect(
            challenge.prompts.find(
              (prompt) => prompt.validation === ChallengeValidation.LocalPasscode
            )
          ).toBeTruthy();
          expect(challenge.reason).toBe(ChallengeReason.SelectProtectedNote);
          const values = challenge.prompts.map(
            (prompt) =>
              new ChallengeValue(
                prompt,
                prompt.validation === ChallengeValidation.LocalPasscode
                  ? passcode
                  : 0
              )
          );

          application.submitValuesForChallenge(challenge, values);
        },
      });
      await application.launch(true);
      await application.addPasscode(passcode);

      const NOTE_COUNT = 3;
      let notes = await Factory.createManyMappedNotes(application, NOTE_COUNT);
      notes[0] = await application.protectNote(notes[0]);
      notes[1] = await application.protectNote(notes[1]);

      expect(await application.authorizeProtectedActionForNotes(
        notes,
        ChallengeReason.SelectProtectedNote
      )).toHaveLength(NOTE_COUNT);
      expect(challengePrompts).toBe(1);
    });

    it('does not return protected notes if challenge is canceled', async function () {
      const passcode = 'passcode🌂';
      let challengePrompts = 0;

      application = Factory.createApplication(Factory.randomString());
      await application.prepareForLaunch({
        receiveChallenge: (challenge) => {
          challengePrompts++;
          application.cancelChallenge(challenge);
        },
      });
      await application.launch(true);
      await application.addPasscode(passcode);

      const NOTE_COUNT = 3;
      let notes = await Factory.createManyMappedNotes(application, NOTE_COUNT);
      notes[0] = await application.protectNote(notes[0]);
      notes[1] = await application.protectNote(notes[1]);

      expect(await application.authorizeProtectedActionForNotes(
        notes,
        ChallengeReason.SelectProtectedNote
      )).toHaveLength(1);
      expect(challengePrompts).toBe(1);
    });
  });

  describe('protectNotes', function () {
    it('protects all notes', async function () {
      application = Factory.createApplication(Factory.randomString());

      const NOTE_COUNT = 3;
      let notes = await Factory.createManyMappedNotes(application, NOTE_COUNT);
      notes = await application.protectNotes(notes);

      for (const note of notes) {
        expect(note.protected).toBe(true);
      }
    })
  });

  describe('unprotect notes', function () {
    it('prompts for password and unprotects all notes if challenge is succesful', async function () {
      let challengePrompts = 0;
      application = Factory.createApplication(Factory.randomString());
      const passcode = 'passcode🌂';

      await application.prepareForLaunch({
        receiveChallenge: (challenge) => {
          challengePrompts += 1;
          expect(
            challenge.prompts.find(
              (prompt) => prompt.validation === ChallengeValidation.LocalPasscode
            )
          ).toBeTruthy();
          expect(challenge.reason).toBe(ChallengeReason.UnprotectNote);
          const values = challenge.prompts.map(
            (prompt) =>
              new ChallengeValue(
                prompt,
                prompt.validation === ChallengeValidation.LocalPasscode
                  ? passcode
                  : 0
              )
          );

          application.submitValuesForChallenge(challenge, values);
        },
      });
      await application.launch(true);
      await application.addPasscode(passcode);

      const NOTE_COUNT = 3;
      let notes = await Factory.createManyMappedNotes(application, NOTE_COUNT);
      notes = await application.protectNotes(notes);
      notes = await application.unprotectNotes(notes);
      
      for (const note of notes) {
        expect(note.protected).toBe(false);
      }
      expect(challengePrompts).toBe(1);
    });

    it('prompts for passcode and unprotects all notes if challenge is succesful', async function () {
      let challengePrompts = 0;
      application = Factory.createApplication(Factory.randomString());
      const passcode = 'passcode🌂';

      await application.prepareForLaunch({
        receiveChallenge: (challenge) => {
          challengePrompts += 1;
          expect(
            challenge.prompts.find(
              (prompt) => prompt.validation === ChallengeValidation.LocalPasscode
            )
          ).toBeTruthy();
          expect(challenge.reason).toBe(ChallengeReason.UnprotectNote);
          const values = challenge.prompts.map(
            (prompt) =>
              new ChallengeValue(
                prompt,
                prompt.validation === ChallengeValidation.LocalPasscode
                  ? passcode
                  : 0
              )
          );

          application.submitValuesForChallenge(challenge, values);
        },
      });
      await application.launch(true);
      await application.addPasscode(passcode);

      const NOTE_COUNT = 3;
      let notes = await Factory.createManyMappedNotes(application, NOTE_COUNT);
      notes = await application.protectNotes(notes);
      notes = await application.unprotectNotes(notes);
      
      for (const note of notes) {
        expect(note.protected).toBe(false);
      }
      expect(challengePrompts).toBe(1);
    });

    it('does not unprotect any notes if challenge is canceled', async function () {
      const passcode = 'passcode🌂';
      let challengePrompts = 0;

      application = Factory.createApplication(Factory.randomString());
      await application.prepareForLaunch({
        receiveChallenge: (challenge) => {
          challengePrompts++;
          application.cancelChallenge(challenge);
        },
      });
      await application.launch(true);
      await application.addPasscode(passcode);

      const NOTE_COUNT = 3;
      let notes = await Factory.createManyMappedNotes(application, NOTE_COUNT);
      notes = await application.protectNotes(notes);
      notes = await application.unprotectNotes(notes);
      
      for (const note of notes) {
        expect(note.protected).toBe(true);
      }
      expect(challengePrompts).toBe(1);
    })
  })
});