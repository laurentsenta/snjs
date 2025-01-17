import * as Factory from './lib/factory.js';
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('features', () => {
  let application;
  let email;
  let password;
  let midnightThemeFeature;
  let boldEditorFeature;
  let tagNestingFeature;
  let getUserFeatures;

  beforeEach(async function () {
    application = await Factory.createInitAppWithRandNamespace();

    const now = new Date();
    const tomorrow = now.setDate(now.getDate() + 1) * 1_000;

    midnightThemeFeature = {
      ...Features.find(
        (feature) => feature.identifier === FeatureIdentifier.MidnightTheme
      ),
      expires_at: tomorrow,
      url: 'https://standardnotes.com'
    };
    boldEditorFeature = {
      ...Features.find(
        (feature) => feature.identifier === FeatureIdentifier.BoldEditor
      ),
      expires_at: tomorrow,
      url: 'https://standardnotes.com'
    };
    tagNestingFeature = {
      ...Features.find(
        (feature) => feature.identifier === FeatureIdentifier.TagNesting
      ),
      expires_at: tomorrow,
      url: 'https://standardnotes.com'
    };

    sinon.spy(application.itemManager, 'createItem');
    sinon.spy(application.itemManager, 'changeComponent');
    sinon.spy(application.itemManager, 'setItemsToBeDeleted');
    sinon.spy(application.componentManager, 'setReadonlyStateForComponent');
    getUserFeatures = sinon
      .stub(application.apiService, 'getUserFeatures')
      .callsFake(() => {
        return Promise.resolve({
          data: {
            features: [
              midnightThemeFeature,
              boldEditorFeature,
              tagNestingFeature,
            ],
          },
        });
      });

    email = Uuid.GenerateUuidSynchronously();
    password = Uuid.GenerateUuidSynchronously();

    await Factory.registerUserToApplication({
      application: application,
      email: email,
      password: password,
    });
  });

  afterEach(async function () {
    Factory.safeDeinit(application);
    sinon.restore();
  });

  describe('new user roles received on api response meta', () => {
    it('should save roles and features', async () => {
      expect(application.featuresService.roles).to.have.lengthOf(1);
      expect(application.featuresService.roles[0]).to.equal(RoleName.BasicUser);

      expect(application.featuresService.features).to.have.lengthOf(3);
      expect(application.featuresService.features[0]).to.equal(
        midnightThemeFeature
      );
      expect(application.featuresService.features[1]).to.equal(
        boldEditorFeature
      );

      const storedRoles = await application.getValue(StorageKey.UserRoles);

      expect(storedRoles).to.have.lengthOf(1);
      expect(storedRoles[0]).to.equal(RoleName.BasicUser);

      const storedFeatures = await application.getValue(
        StorageKey.UserFeatures
      );

      expect(storedFeatures).to.have.lengthOf(3);
      expect(storedFeatures[0]).to.equal(midnightThemeFeature);
      expect(storedFeatures[1]).to.equal(boldEditorFeature);
      expect(storedFeatures[2]).to.equal(tagNestingFeature);
    });

    it('should fetch user features and create items for features with content type', async () => {
      expect(application.apiService.getUserFeatures.callCount).to.equal(1);
      expect(application.itemManager.createItem.callCount).to.equal(2);
      const themeItems = application.getItems(ContentType.Theme);
      const editorItems = application.getItems(ContentType.Component);
      expect(themeItems).to.have.lengthOf(1);
      expect(editorItems).to.have.lengthOf(1);
      expect(themeItems[0].content).to.containSubset(
        JSON.parse(
          JSON.stringify({
            name: midnightThemeFeature.name,
            hosted_url: midnightThemeFeature.url,
            package_info: midnightThemeFeature,
            valid_until: new Date(midnightThemeFeature.expires_at),
          })
        )
      );
      expect(editorItems[0].content).to.containSubset(
        JSON.parse(
          JSON.stringify({
            name: boldEditorFeature.name,
            hosted_url: boldEditorFeature.url,
            area: boldEditorFeature.area,
            package_info: boldEditorFeature,
            valid_until: new Date(midnightThemeFeature.expires_at),
          })
        )
      );
    });

    it('should update content for existing feature items', async () => {
      // Wipe items from initial sync
      await application.itemManager.removeAllItemsFromMemory();
      // Wipe roles from initial sync
      await application.featuresService.setRoles([]);
      // Create pre-existing item for theme without all the info
      await application.itemManager.createItem(
        ContentType.Theme,
        FillItemContent({
          package_info: {
            identifier: FeatureIdentifier.MidnightTheme,
          },
        })
      );
      // Call sync intentionally to get roles again in meta
      await application.sync();
      // Timeout since we don't await for features update
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(application.itemManager.changeComponent.callCount).to.equal(1);
      const themeItems = application.getItems(ContentType.Theme);
      expect(themeItems).to.have.lengthOf(1);
      expect(themeItems[0].content).to.containSubset(
        JSON.parse(
          JSON.stringify({
            hosted_url: midnightThemeFeature.url,
            package_info: midnightThemeFeature,
            valid_until: new Date(midnightThemeFeature.expires_at),
          })
        )
      );
    });

    it('should set component to read only if feature has expired', async () => {
      const now = new Date();
      const yesterday = now.setDate(now.getDate() - 1);

      getUserFeatures.restore();
      sinon.stub(application.apiService, 'getUserFeatures').callsFake(() => {
        return Promise.resolve({
          data: {
            features: [
              {
                ...boldEditorFeature,
                expires_at: yesterday,
              },
            ],
          },
        });
      });

      // Wipe roles from initial sync
      await application.featuresService.setRoles([]);
      // Call sync intentionally to get roles again in meta
      await application.sync();
      // Timeout since we don't await for features update
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(
        application.componentManager.setReadonlyStateForComponent.callCount
      ).to.equal(1);
      const editorItems = application.getItems(ContentType.Component);
      expect(
        application.componentManager.getReadonlyStateForComponent(
          editorItems[0]
        ).readonly
      ).to.equal(true);
    });

    it('should delete theme item if feature has expired', async () => {
      const now = new Date();
      const yesterday = now.setDate(now.getDate() - 1);

      getUserFeatures.restore();
      sinon.stub(application.apiService, 'getUserFeatures').callsFake(() => {
        return Promise.resolve({
          data: {
            features: [
              {
                ...midnightThemeFeature,
                expires_at: yesterday,
              },
            ],
          },
        });
      });

      const themeItemUuid = application.getItems(ContentType.Theme)[0].uuid;

      // Wipe roles from initial sync
      await application.featuresService.setRoles([]);
      // Call sync intentionally to get roles again in meta
      await application.sync();
      // Timeout since we don't await for features update
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(
        application.itemManager.setItemsToBeDeleted.calledWith([themeItemUuid])
      ).to.be.ok;

      const themeItem = application.getItems(ContentType.Theme)[0];
      expect(themeItem).to.not.be.ok;
    });
  });

  it('should provide feature', async () => {
    const feature = application.getFeature(FeatureIdentifier.BoldEditor);
    expect(feature).to.equal(boldEditorFeature);
  });

  describe('extension repo items observer', () => {
    it('should migrate to user setting when extension repo is added', async () => {
      sinon
        .stub(application.apiService, 'isCustomServerHostUsed')
        .callsFake(() => {
          return false;
        });
      expect(
        await application.getSensitiveSetting(SettingName.ExtensionKey)
      ).to.equal(false);
      const extensionKey = Uuid.GenerateUuidSynchronously().split('-').join('');
      const promise = new Promise((resolve) => {
        sinon
          .stub(application.featuresService, 'migrateFeatureRepoToUserSetting')
          .callsFake(resolve);
      });
      await application.itemManager.createItem(
        ContentType.ExtensionRepo,
        FillItemContent({
          url: `https://extensions.standardnotes.org/${extensionKey}`,
        })
      );
      await promise;
    });

    it('signing into account with ext repo should migrate it', async () => {
      sinon
        .stub(application.apiService, 'isCustomServerHostUsed')
        .callsFake(() => {
          return false;
        });
      /** Attach an ExtensionRepo object to an account, but prevent it from being migrated.
       * Then sign out, sign back in, and ensure the item is migrated. */
      /** Prevent migration from running */
      sinon
        .stub(application.featuresService, 'migrateFeatureRepoToUserSetting')
        .callsFake(() => {});
      const extensionKey = Uuid.GenerateUuidSynchronously().split('-').join('');
      await application.createManagedItem(
        ContentType.ExtensionRepo,
        FillItemContent({
          url: `https://extensions.standardnotes.org/${extensionKey}`,
        }),
        true
      );
      await application.sync();
      application = await Factory.signOutApplicationAndReturnNew(application);

      sinon.restore();
      sinon
        .stub(application.apiService, 'isCustomServerHostUsed')
        .callsFake(() => {
          return false;
        });
      const promise = new Promise((resolve) => {
        sinon
          .stub(application.featuresService, 'migrateFeatureRepoToUserSetting')
          .callsFake(resolve);
      });
      await Factory.loginToApplication({
        application,
        email,
        password,
      });
      await promise;
    });

    it('having an ext repo with no account, then signing into account, should migrate it', async () => {
      application = await Factory.signOutApplicationAndReturnNew(application);
      sinon
        .stub(application.apiService, 'isCustomServerHostUsed')
        .callsFake(() => {
          return false;
        });
      const extensionKey = Uuid.GenerateUuidSynchronously().split('-').join('');
      await application.createManagedItem(
        ContentType.ExtensionRepo,
        FillItemContent({
          url: `https://extensions.standardnotes.org/${extensionKey}`,
        }),
        true
      );
      await application.sync();

      const promise = new Promise((resolve) => {
        sinon
          .stub(application.featuresService, 'migrateFeatureRepoToUserSetting')
          .callsFake(resolve);
      });
      await Factory.loginToApplication({
        application,
        email,
        password,
      });
      await promise;
    });

    it('migrated ext repo should have property indicating it was migrated', async () => {
      sinon
        .stub(application.apiService, 'isCustomServerHostUsed')
        .callsFake(() => {
          return false;
        });
      expect(
        await application.getSensitiveSetting(SettingName.ExtensionKey)
      ).to.equal(false);
      const extensionKey = Uuid.GenerateUuidSynchronously().split('-').join('');
      const promise = new Promise((resolve) => {
        application.streamItems(ContentType.ExtensionRepo, (changed) => {
          for (const item of changed) {
            if (item.content.migratedToUserSetting) {
              resolve();
            }
          }
        });
      });
      await application.itemManager.createItem(
        ContentType.ExtensionRepo,
        FillItemContent({
          url: `https://extensions.standardnotes.org/${extensionKey}`,
        })
      );
      await promise;
    });
  });

  describe('offline features migration', () => {
    it('previous extension repo should be migrated to offline feature repo', async () => {
      const extensionKey = Uuid.GenerateUuidSynchronously().split('-').join('');
      await application.createManagedItem(
        ContentType.ExtensionRepo,
        FillItemContent({
          url: `https://extensions.standardnotes.org/${extensionKey}`,
        }),
        true
      );
      await application.sync();

      const repo = application.featuresService.getOfflineRepo();
      expect(repo.migratedToOfflineEntitlements).to.equal(true);
      expect(repo.offlineFeaturesUrl).to.equal(
        'https://api.standardnotes.com/v1/offline/features'
      );
      expect(repo.offlineKey).to.equal(extensionKey);
    });
  });
});
