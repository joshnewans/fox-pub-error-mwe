# pub-error-mwe

This package is a minimum example of some issues I am having while developing a foxglove extension. They are probably just the result of my own lack of understanding of JS/TS/React/Foxglove.

When you get stuck, just reset panel settings to defaults to restore.

Tested with ROS foxy, rosbridge, and joy_linux_node as the source of Joy message.

## Issue 1 - Joy message cannot be passed directly from sub to pub

When the Joy message is parsed by Foxglove, the `axes` and `button` members appear to be `Float32Array` and `Int32Array` respectively. This is seen by the console log of `console.log(latestMsg.buttons);` and by the parsed JSON which represents it oddly (an object of numerical strings as keys).

If you try to publish this directly, the publish will fail silently. You can test this by toggling the `publishConverted` setting.

I have gotten around this by creating a new object that performs the conversion

```
const tmpMsg = {
    header: latestMsg.header,
    axes: Array.from(latestMsg.axes),
    buttons: Array.from(latestMsg.buttons),
};
```

This feels like a bug? Or perhaps I am missing something.

## Issue 2 - Publisher not starting up in time

This issue has manifested differently in various iterations of my code, but there are two versions of it present here.

The `useEffect` that is driving the publish (line 162 onwards) is failing with an unadvertised topic, despite it being advertised already.

I assume this is my own misunderstanding of React effects but I am unclear how to proceed.

### With advertise in the layout effect

With line 116 intact, the topic is advertised in useLayoutEffect.

```
// COMMENT OUT THE LINE BELOW
context.advertise?.("/joy2", "sensor_msgs/msg/Joy");
```

This works fine if Foxglove is started with the panel's `publishOn` setting turned off, and then turned on. The messages will be seen in ROS (if they are being converted as per issue 1).

If left on and foxglove closes and reopens, the panel instantly fails.

This is despite (as per the console logs) the advertise step apparently running prior (perhaps with no/different context??).

### Without advertise in the layout effect

With line 116 commented out (as intended), the code should not attempt to advertise the topic until the moment the publishOn setting is enabled. This should trigger the advertising and then the publish. If the publish runs first that should be ok as it checks that the `pubTopic` variable has been set, which is set as part of advertising.

What happens when you turn publish on is that it fails straight away with the same error as before. Perhaps it is deferring the actual advertise until after the variable has been set? But if so I don't see how I can work around the issue safely.

## Issue 3 - ROS 1 vs ROS 2 datatypes

It seems that to support both, the filter in Line 63 has to have both ROS 1 and 2 datatypes, and the advertise in line 155 can work with either?

I assume this is documented somewhere and I haven't really tested it. It just seems a little inconsistent that one works both ways and the other doesn't?


