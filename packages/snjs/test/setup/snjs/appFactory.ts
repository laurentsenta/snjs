import { SNApplication, Environment, Platform, SNLog, SNComponentManager } from '@Lib/index';
import { WebComponentManager, MobileComponentManager } from './componentManager';
import DeviceInterface from './deviceInterface';
import SNCrypto from './snCrypto';

const getSwappedClasses = (environment: Environment) => {
  const classMap = {
    swap: SNComponentManager,
    with: WebComponentManager
  };
  switch (environment) {
    case Environment.Mobile:
      classMap.with = MobileComponentManager;
      break;
  }
  return [classMap];
};

export const createApplication = async (identifier: string, environment: Environment, platform: Platform) => {
  const deviceInterface = new DeviceInterface(
    setTimeout.bind(window),
    setInterval.bind(window)
  );
  SNLog.onLog = (message) => {
    console.log(message);
  };
  SNLog.onError = (error) => {
    console.error(error);
  };
  const application = new SNApplication(
    environment,
    platform,
    deviceInterface,
    new SNCrypto(),
    {
      confirm: async () => true,
      alert: async () => {},
      blockingDialog: () => () => {},
    },
    identifier,
    getSwappedClasses(environment),
    'http://api.localhost',
    'ws://localhost'
  );
  await application.prepareForLaunch({
    receiveChallenge: (_challenge) => {
      throw Error('Factory application shouldn\'t have challenges');
    }
  });
  await application.launch(true);
  return application;
};
