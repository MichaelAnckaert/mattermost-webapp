// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {Client4} from 'mattermost-redux/client';

import Root from 'components/root/root';
import * as GlobalActions from 'actions/global_actions';
import * as Utils from 'utils/utils';
import Constants, {StoragePrefixes} from 'utils/constants';

jest.mock('fastclick', () => ({
    attach: () => {}, // eslint-disable-line no-empty-function
}));

jest.mock('rudder-sdk-js', () => ({
    identify: jest.fn(),
    load: jest.fn(),
    page: jest.fn(),
    track: jest.fn(),
}));

jest.mock('actions/telemetry_actions', () => ({
    trackLoadTime: () => {}, // eslint-disable-line no-empty-function
}));

jest.mock('actions/global_actions', () => ({
    redirectUserToDefaultTeam: jest.fn(),
}));

jest.mock('utils/utils', () => ({
    localizeMessage: () => {},
    isDevMode: jest.fn(),
    enableDevModeFeatures: jest.fn(),
    applyTheme: jest.fn(),
    makeIsEligibleForClick: jest.fn(),
    areObjectsEqual: jest.fn(),
}));

jest.mock('mattermost-redux/actions/general', () => ({
    setUrl: () => {},
}));

describe('components/Root', () => {
    const baseProps = {
        telemetryEnabled: true,
        telemetryId: '1234ab',
        noAccounts: false,
        showTermsOfService: false,
        theme: {},
        actions: {
            loadMeAndConfig: async () => [{}, {}, {data: true}], // eslint-disable-line no-empty-function
            emitBrowserWindowResized: () => {},
        },
        location: {
            pathname: '/',
        },
    };

    test('should load config and license on mount and redirect to sign-up page', () => {
        const props = {
            ...baseProps,
            noAccounts: true,
            actions: {
                ...baseProps.actions,
                loadMeAndConfig: jest.fn(async () => [{}, {}, {}]),
            },
            history: {
                push: jest.fn(),
            },
        };

        const wrapper = shallow(<Root {...props}/>);

        expect(props.actions.loadMeAndConfig).toHaveBeenCalledTimes(1);

        wrapper.instance().onConfigLoaded();
        expect(props.history.push).toHaveBeenCalledWith('/signup_user_complete');
        wrapper.unmount();
    });

    test('should load user, config, and license on mount and redirect to defaultTeam on success', (done) => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                loadMeAndConfig: jest.fn(baseProps.actions.loadMeAndConfig),
            },
        };

        // Mock the method by extending the class because we don't have a chance to do it before shallow mounts the component
        class MockedRoot extends Root {
            onConfigLoaded = jest.fn(() => {
                expect(this.onConfigLoaded).toHaveBeenCalledTimes(1);
                expect(GlobalActions.redirectUserToDefaultTeam).toHaveBeenCalledTimes(1);
                done();
            });
        }

        const wrapper = shallow(<MockedRoot {...props}/>);

        expect(props.actions.loadMeAndConfig).toHaveBeenCalledTimes(1);
        wrapper.unmount();
    });

    test('should load user, config, and license on mount and should not redirect to defaultTeam id pathname is not root', (done) => {
        const props = {
            ...baseProps,
            location: {
                pathname: '/admin_console',
            },
        };

        // Mock the method by extending the class because we don't have a chance to do it before shallow mounts the component
        class MockedRoot extends Root {
            onConfigLoaded = jest.fn(() => {
                expect(this.onConfigLoaded).toHaveBeenCalledTimes(1);
                expect(GlobalActions.redirectUserToDefaultTeam).not.toHaveBeenCalled();
                done();
            });
        }

        const wrapper = shallow(<MockedRoot {...props}/>);
        wrapper.unmount();
    });

    test('should load config and enable dev mode features', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                loadMeAndConfig: jest.fn(async () => [{}, {}, {}]),
            },
        };
        Utils.isDevMode.mockReturnValue(true);

        const wrapper = shallow(<Root {...props}/>);

        expect(props.actions.loadMeAndConfig).toHaveBeenCalledTimes(1);

        // Must be invoked in onConfigLoaded
        expect(Utils.isDevMode).not.toHaveBeenCalled();
        expect(Utils.enableDevModeFeatures).not.toHaveBeenCalled();

        wrapper.instance().onConfigLoaded();
        expect(Utils.isDevMode).toHaveBeenCalledTimes(1);
        expect(Utils.enableDevModeFeatures).toHaveBeenCalledTimes(1);
        wrapper.unmount();
    });

    test('should load config and not enable dev mode features', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                loadMeAndConfig: jest.fn(async () => [{}, {}, {}]),
            },
        };
        Utils.isDevMode.mockReturnValue(false);

        const wrapper = shallow(<Root {...props}/>);

        expect(props.actions.loadMeAndConfig).toHaveBeenCalledTimes(1);

        // Must be invoked in onConfigLoaded
        expect(Utils.isDevMode).not.toHaveBeenCalled();
        expect(Utils.enableDevModeFeatures).not.toHaveBeenCalled();

        wrapper.instance().onConfigLoaded();
        expect(Utils.isDevMode).toHaveBeenCalledTimes(1);
        expect(Utils.enableDevModeFeatures).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    test('should call history on props change', () => {
        const props = {
            ...baseProps,
            noAccounts: false,

            history: {
                push: jest.fn(),
            },
        };
        const wrapper = shallow(<Root {...props}/>);
        expect(props.history.push).not.toHaveBeenCalled();
        const props2 = {
            noAccounts: true,
        };
        wrapper.setProps(props2);
        expect(props.history.push).toHaveBeenLastCalledWith('/signup_user_complete');
        wrapper.unmount();
    });

    describe('onConfigLoaded', () => {
        // Replace loadMeAndConfig with an action that never resolves so we can control exactly when onConfigLoaded is called
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                loadMeAndConfig: () => new Promise(() => {}),
            },
        };

        test('should not set a TelemetryHandler when onConfigLoaded is called if Rudder is not configured', () => {
            const wrapper = shallow(<Root {...props}/>);

            wrapper.instance().onConfigLoaded();

            Client4.trackEvent('category', 'event');

            expect(Client4.telemetryHandler).not.toBeDefined();

            wrapper.unmount();
        });

        test('should set a TelemetryHandler when onConfigLoaded is called if Rudder is configured', () => {
            Constants.TELEMETRY_RUDDER_KEY = 'testKey';
            Constants.TELEMETRY_RUDDER_DATAPLANE_URL = 'url';

            const wrapper = shallow(<Root {...props}/>);

            wrapper.instance().onConfigLoaded();

            Client4.trackEvent('category', 'event');

            expect(Client4.telemetryHandler).toBeDefined();

            wrapper.unmount();
        });
    });

    test('should reload on focus after getting signal login event from another tab', () => {
        Object.defineProperty(window.location, 'reload', {
            configurable: true,
            writable: true,
        });
        window.location.reload = jest.fn();
        const wrapper = shallow(<Root {...baseProps}/>);
        const loginSignal = new StorageEvent('storage', {
            key: StoragePrefixes.LOGIN,
            newValue: String(Math.random()),
            storageArea: localStorage,
        });

        window.dispatchEvent(loginSignal);
        document.dispatchEvent(new Event('visibilitychange'));
        expect(window.location.reload).toBeCalledTimes(1);
        wrapper.unmount();
    });

    test('should update redux when the browser window is resized', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                emitBrowserWindowResized: jest.fn(),
            },
        };

        const wrapper = shallow(<Root {...props}/>);

        window.dispatchEvent(new UIEvent('resize'));

        expect(props.actions.emitBrowserWindowResized).toBeCalledTimes(2); // called once in constructor

        wrapper.unmount();
    });
});
