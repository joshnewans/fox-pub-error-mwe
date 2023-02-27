import {
  PanelExtensionContext,
  RenderState,
  Topic,
  MessageEvent,
  SettingsTreeAction,
} from "@foxglove/studio";
import produce from "immer";
import { set } from "lodash";
import { useLayoutEffect, useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom";

type Header = {
  frame_id: string;
};

type Joy = {
  header: Header;
  axes: number[];
  buttons: number[];
};

type Config = {
  subTopic: string;
  pubTopic: string;
  publishOn: boolean;
  publishConverted: boolean;
};

function ExamplePanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();
  const [messages, setMessages] = useState<readonly MessageEvent<unknown>[] | undefined>();
  const [rawMsg, setRawMsg] = useState<Joy | undefined>();
  const [convMsg, setConvMsg] = useState<Joy | undefined>();
  const [, setSubTopic] = useState<string | undefined>();
  const [pubTopic, setPubTopic] = useState<string | undefined>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  // Build our panel state from the context's initialState, filling in any possibly missing values.
  const [config, setConfig] = useState<Config>(() => {
    const partialConfig = context.initialState as Partial<Config>;
    partialConfig.subTopic ??= "/joy";
    partialConfig.pubTopic ??= "/joy2";
    partialConfig.publishOn ??= false;
    partialConfig.publishConverted ??= true;
    return partialConfig as Config;
  });

  // Respond to actions from the settings editor to update our state.
  const actionHandler = useCallback((action: SettingsTreeAction) => {
    if (action.action === "update") {
      const { path, value } = action.payload;
      setConfig(produce((draft) => set(draft, path.slice(1, 2), value)));
    }
  }, []);

  // Update the settings editor every time our state or the list of available topics changes.
  useEffect(() => {
    context.saveState(config);

    const topicOptions = (topics ?? [])
      .filter((topic) => topic.datatype === "sensor_msgs/msg/Joy")
      .map((topic) => ({ value: topic.name, label: topic.name }));

    // We set up our settings tree to mirror the shape of our panel state so we
    // can use the paths to values from the settings tree to directly update our state.
    context.updatePanelSettingsEditor({
      actionHandler,
      nodes: {
        data: {
          label: "Data",
          fields: {
            subTopic: {
              label: "subTopic",
              input: "select",
              options: topicOptions,
              value: config.subTopic,
            },
            pubTopic: {
              label: "pubTopic",
              input: "string",
              value: config.pubTopic,
            },
            publishOn: {
              label: "publishOn",
              input: "boolean",
              value: config.publishOn,
            },
            publishConverted: {
              label: "publishConverted",
              input: "boolean",
              value: config.publishConverted,
            },
          },
        },
      },
    });
  }, [context, actionHandler, config, topics]);

  // We use a layout effect to setup render handling for our panel. We also setup some topic subscriptions.
  useLayoutEffect(() => {

    context.onRender = (renderState: RenderState, done) => {
      setRenderDone(() => done);
      setTopics(renderState.topics);
      if (renderState.currentFrame) {
        setMessages(renderState.currentFrame);
      }
    };

    context.watch("topics");
    context.watch("currentFrame");

    // COMMENT OUT THE LINE BELOW
    context.advertise?.("/joy2", "sensor_msgs/msg/Joy");

  }, [context, config]);


  // Subscribe to the topic
  useEffect(() => {
    console.log("Subscribe to " + config.subTopic);
    setSubTopic(() => {
      context.subscribe([config.subTopic]);
      return config.subTopic;
    });
  }, [config.subTopic, context]);

  // Process messages
  useEffect(() => {
    const latestMsg = messages?.[messages?.length - 1]?.message as Joy | undefined;
    if (latestMsg) {
      console.log(latestMsg.buttons);
      setRawMsg(latestMsg);

      const tmpMsg = {
        header: latestMsg.header,
        axes: Array.from(latestMsg.axes),
        buttons: Array.from(latestMsg.buttons),
      };
      setConvMsg(tmpMsg);
    }
  }, [messages]);


  // Advertise the publish topic
  useEffect(() => {
    console.log("About to advertise publisher on " + config.pubTopic);
    if (config.publishOn) {
      setPubTopic((oldTopic) => {
        if (oldTopic) {
          context.unadvertise?.(oldTopic);
        }
        context.advertise?.(config.pubTopic, "sensor_msgs/msg/Joy");
        return config.pubTopic;
      });
    }
  }, [config.publishOn, config.pubTopic, context]);

  // Publish the joy message
  useEffect(() => {

    if (!config.publishOn) {
      return;
    }

    if (pubTopic && pubTopic === config.pubTopic) {
      context.publish?.(config.pubTopic, config.publishConverted ? convMsg : rawMsg);
    }
  }, [
    context,
    config.pubTopic,
    config.publishOn,
    config.publishConverted,
    rawMsg,
    convMsg,
    pubTopic,
  ]);

  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  return (
    <div style={{ padding: "1rem" }}>
      Raw message (JSON format):
      {JSON.stringify(rawMsg)}
      <br />
      Converted message (JSON format):
      {JSON.stringify(convMsg)}
      <br />
      Raw message .axes (direct output)
      {typeof rawMsg?.axes}
      <br />
      Converted message .axes (direct output)
      {typeof convMsg?.axes}
    </div>
  );
}

export function initExamplePanel(context: PanelExtensionContext): void {
  ReactDOM.render(<ExamplePanel context={context} />, context.panelElement);
}