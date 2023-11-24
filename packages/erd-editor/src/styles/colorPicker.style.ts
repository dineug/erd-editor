/**
 * https://github.com/easylogic/colorpicker
 */
const colorPicker = /* css */ `
/* easylogic-colorpicker */
.easylogic-colorpicker {
  position: relative;
  width: 224px;
  z-index: 1000;
  display: inline-block;
  border: 1px solid rgba(0, 0, 0, 0.2);
  background-color: #fff;
  border-radius: 3px;
  -webkit-box-shadow: 0 0px 10px 2px rgba(0, 0, 0, 0.12);
  box-shadow: 0 0px 10px 2px rgba(0, 0, 0, 0.12);
  outline: none;
  /* theme */
}
.easylogic-colorpicker > .arrow {
  position: absolute;
  top: -10px;
  left: 7px;
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  display: none;
  border-bottom: 10px solid rgba(0, 0, 0, 0.2);
  pointer-events: none;
}
.easylogic-colorpicker > .arrow:after {
  position: absolute;
  content: '';
  top: 1px;
  left: -9px;
  width: 0;
  height: 0;
  border-left: 9px solid transparent;
  border-right: 9px solid transparent;
  border-bottom: 9px solid white;
}
.easylogic-colorpicker .colorpicker-body .arrow-button {
  position: relative;
  width: 10px;
  height: 12px;
  padding: 0px;
  background-color: transparent;
}
.easylogic-colorpicker .colorpicker-body .arrow-button:before {
  content: '';
  display: inline-block;
  position: absolute;
  left: 0px;
  right: 0px;
  top: 0px;
  height: 50%;
  width: 0;
  height: 0;
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  border-bottom: 3px solid black;
  pointer-events: none;
  margin: 2px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker .colorpicker-body .arrow-button:after {
  content: '';
  display: inline-block;
  position: absolute;
  left: 0px;
  right: 0px;
  bottom: 0px;
  top: 50%;
  width: 0;
  height: 0;
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  border-top: 3px solid black;
  pointer-events: none;
  margin: 2px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker .colorpicker-body .color {
  position: relative;
  height: 120px;
  overflow: hidden;
  cursor: pointer;
}
.easylogic-colorpicker .colorpicker-body .color > .saturation {
  position: relative;
  width: 100%;
  height: 100%;
}
.easylogic-colorpicker .colorpicker-body .color > .saturation > .value {
  position: relative;
  width: 100%;
  height: 100%;
}
.easylogic-colorpicker
  .colorpicker-body
  .color
  > .saturation
  > .value
  > .drag-pointer {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  -webkit-transform: translateX(-50%) translateY(-50%);
  transform: translateX(-50%) translateY(-50%);
}
.easylogic-colorpicker
  .colorpicker-body
  .color
  > .saturation
  > .value
  > .drag-pointer
  > div {
  border: 1px solid #ececec;
  -webkit-box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.05);
  box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.05);
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  position: absolute;
  width: 10px;
  height: 4px;
  background-color: white;
}
.easylogic-colorpicker
  .colorpicker-body
  .color
  > .saturation
  > .value
  > .drag-pointer
  .left-saturation {
  left: 0%;
  top: 50%;
  -webkit-transform: translateX(calc(-100% - 4px)) translateY(-50%);
  transform: translateX(calc(-100% - 4px)) translateY(-50%);
  cursor: col-resize;
}
.easylogic-colorpicker
  .colorpicker-body
  .color
  > .saturation
  > .value
  > .drag-pointer
  .right-saturation {
  left: 100%;
  top: 50%;
  -webkit-transform: translateX(4px) translateY(-50%);
  transform: translateX(4px) translateY(-50%);
  cursor: col-resize;
}
.easylogic-colorpicker
  .colorpicker-body
  .color
  > .saturation
  > .value
  > .drag-pointer
  .top-value {
  width: 4px;
  height: 10px;
  left: 50%;
  top: 0%;
  -webkit-transform: translateX(-50%) translateY(calc(-100% - 4px));
  transform: translateX(-50%) translateY(calc(-100% - 4px));
  cursor: row-resize;
}
.easylogic-colorpicker
  .colorpicker-body
  .color
  > .saturation
  > .value
  > .drag-pointer
  .bottom-value {
  width: 4px;
  height: 10px;
  left: 50%;
  top: 100%;
  -webkit-transform: translateX(-50%) translateY(4px);
  transform: translateX(-50%) translateY(4px);
  cursor: row-resize;
}
.easylogic-colorpicker .colorpicker-body .color > .saturation {
  background-color: rgba(204, 154, 129, 0);
  background-image: -webkit-gradient(
    linear,
    left top,
    right top,
    from(#fff),
    to(rgba(204, 154, 129, 0))
  );
  background-image: linear-gradient(to right, #fff, rgba(204, 154, 129, 0));
  background-repeat: repeat-x;
}
.easylogic-colorpicker .colorpicker-body .color > .saturation > .value {
  background-image: -webkit-gradient(
    linear,
    left bottom,
    left top,
    from(#000000),
    to(rgba(204, 154, 129, 0))
  );
  background-image: linear-gradient(to top, #000000, rgba(204, 154, 129, 0));
}
.easylogic-colorpicker
  .colorpicker-body
  .color
  > .saturation
  > .value
  > .drag-pointer {
  border: 1px solid #fff;
  -webkit-box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.05);
  box-shadow: 0 0 2px 0 rgba(0, 0, 0, 0.05);
}
.easylogic-colorpicker .colorpicker-body .control {
  position: relative;
  padding: 10px 0px 10px 0px;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
.easylogic-colorpicker .colorpicker-body .control > .color,
.easylogic-colorpicker .colorpicker-body .control > .empty {
  position: absolute;
  left: 12px;
  top: 14px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker .colorpicker-body .control > .color2,
.easylogic-colorpicker .colorpicker-body .control > .empty2 {
  position: absolute;
  left: 12px;
  top: 50px;
  width: 30px;
  height: 20px;
  border-radius: 4px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker .colorpicker-body .control > .color {
  border: 1px solid rgba(0, 0, 0, 0.1);
}
.easylogic-colorpicker .colorpicker-body .control > .hue {
  position: relative;
  padding: 3px 16px;
  margin: 0px 0px 0px 42px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  cursor: pointer;
}
.easylogic-colorpicker .colorpicker-body .control > .hue > .hue-container {
  position: relative;
  width: 100%;
  height: 14px;
  border-radius: 3px;
}
.easylogic-colorpicker .colorpicker-body .control > .hue-scale {
  position: relative;
  padding: 3px 16px;
  margin: 0px 0px 0px 42px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  cursor: pointer;
}
.easylogic-colorpicker
  .colorpicker-body
  .control
  > .hue-scale
  > .hue-scale-container {
  position: relative;
  width: 100%;
  height: 14px;
}
.easylogic-colorpicker .colorpicker-body .control > .opacity {
  position: relative;
  padding: 3px 16px;
  margin: 0px 0px 0px 42px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  cursor: pointer;
}
.easylogic-colorpicker
  .colorpicker-body
  .control
  > .opacity
  > .opacity-container {
  position: relative;
  width: 100%;
  height: 14px;
  border-radius: 3px;
}
.easylogic-colorpicker .colorpicker-body .control .drag-bar,
.easylogic-colorpicker .colorpicker-body .control .drag-bar2 {
  position: absolute;
  cursor: pointer;
  top: 50%;
  left: 0px;
  -webkit-transform: translateX(-50%) translateY(-50%);
  transform: translateX(-50%) translateY(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.easylogic-colorpicker .colorpicker-body .control > .hue > .hue-container {
  background: -webkit-gradient(
    linear,
    left top,
    right top,
    from(#ff0000),
    color-stop(17%, #ffff00),
    color-stop(33%, #00ff00),
    color-stop(50%, #00ffff),
    color-stop(67%, #0000ff),
    color-stop(83%, #ff00ff),
    to(#ff0000)
  );
  background: linear-gradient(
    to right,
    #ff0000 0%,
    #ffff00 17%,
    #00ff00 33%,
    #00ffff 50%,
    #0000ff 67%,
    #ff00ff 83%,
    #ff0000 100%
  );
}
.easylogic-colorpicker
  .colorpicker-body
  .control
  > .opacity
  > .opacity-container {
  background-color: transparent;
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
}
.easylogic-colorpicker
  .colorpicker-body
  .control
  > .opacity
  > .opacity-container
  > .color-bar {
  position: absolute;
  display: block;
  content: '';
  left: 0px;
  right: 0px;
  bottom: 0px;
  top: 0px;
}
.easylogic-colorpicker .colorpicker-body .control > .empty,
.easylogic-colorpicker .colorpicker-body .control > .empty2 {
  background-color: transparent;
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
}
.easylogic-colorpicker .colorpicker-body .control .drag-bar,
.easylogic-colorpicker .colorpicker-body .control .drag-bar2 {
  border: 1px solid rgba(0, 0, 0, 0.05);
  -webkit-box-shadow: 2px 2px 2px 0px rgba(0, 0, 0, 0.2);
  box-shadow: 2px 2px 2px 0px rgba(0, 0, 0, 0.2);
  background-color: #fefefe;
}
.easylogic-colorpicker .colorpicker-body .information {
  /*border-top: 1px solid #e8e8e8;*/
  position: relative;
  -webkit-box-sizing: padding-box;
  box-sizing: padding-box;
}
.easylogic-colorpicker .colorpicker-body .information > input {
  position: absolute;
  font-size: 10px;
  height: 20px;
  bottom: 20px;
  padding: 0 0 0 2px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}
.easylogic-colorpicker .colorpicker-body .information > input[type='number'] {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
.easylogic-colorpicker
  .colorpicker-body
  .information
  > input[type='number']::-webkit-inner-spin-button,
.easylogic-colorpicker
  .colorpicker-body
  .information
  > input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
.easylogic-colorpicker
  .colorpicker-body
  .information.hex
  > .information-item.hex {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
}
.easylogic-colorpicker
  .colorpicker-body
  .information.rgb
  > .information-item.rgb {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
}
.easylogic-colorpicker
  .colorpicker-body
  .information.hsl
  > .information-item.hsl {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
}
.easylogic-colorpicker .colorpicker-body .information > .information-item {
  display: none;
  position: relative;
  padding: 0px 5px;
  padding-left: 9px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  margin-right: 40px;
}
.easylogic-colorpicker
  .colorpicker-body
  .information
  > .information-item
  > .input-field {
  display: block;
  -webkit-box-flex: 1;
  -ms-flex: 1;
  flex: 1;
  padding: 3px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  position: relative;
}
.easylogic-colorpicker
  .colorpicker-body
  .information
  > .information-item
  > .input-field
  > .title {
  text-align: center;
  font-size: 12px;
  color: #a9a9a9;
  padding-top: 2px;
}
.easylogic-colorpicker
  .colorpicker-body
  .information
  > .information-item
  > .input-field
  input {
  text-align: center;
  width: 100%;
  padding: 3px;
  height: 21px;
  font-size: 11px;
  color: #333;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
  border: 1px solid #cbcbcb;
  border-radius: 2px;
}
.easylogic-colorpicker
  .colorpicker-body
  .information
  > .information-item
  > .input-field
  input[type='number'] {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
.easylogic-colorpicker
  .colorpicker-body
  .information
  > .information-item
  > .input-field
  input[type='number']::-webkit-inner-spin-button,
.easylogic-colorpicker
  .colorpicker-body
  .information
  > .information-item
  > .input-field
  input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
.easylogic-colorpicker
  .colorpicker-body
  .information
  > .information-item
  > .input-field.hsl-l
  input[type='number'],
.easylogic-colorpicker
  .colorpicker-body
  .information
  > .information-item
  > .input-field.hsl-s
  input[type='number'] {
  padding-left: 1px;
  padding-right: 10px;
}
.easylogic-colorpicker
  .colorpicker-body
  .information
  > .information-item
  > .input-field
  .postfix {
  display: inline-block;
  position: absolute;
  right: 3px;
  top: 2px;
  height: 21px;
  line-height: 2;
  padding: 2px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  text-align: center;
  font-size: 11px;
}
.easylogic-colorpicker .colorpicker-body .information > .information-change {
  position: absolute;
  display: block;
  width: 40px;
  top: 0px;
  right: 0px;
  bottom: 0px;
  text-align: center;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  padding-top: 5px;
}
.easylogic-colorpicker
  .colorpicker-body
  .information
  > .information-change
  > .format-change-button {
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  background: transparent;
  border: 0px;
  cursor: pointer;
  outline: none;
}
.easylogic-colorpicker .colorpicker-body .information > .title {
  color: #a3a3a3;
}
.easylogic-colorpicker .colorpicker-body .information > .input {
  color: #333;
}
.easylogic-colorpicker .colorpicker-body .colorsets {
  border-top: 1px solid #e2e2e2;
}
.easylogic-colorpicker .colorpicker-body .colorsets > .menu {
  float: right;
  padding: 10px 5px;
  padding-right: 15px;
}
.easylogic-colorpicker .colorpicker-body .colorsets > .menu button {
  border: 0px;
  font-size: 14px;
  font-weight: 300;
  font-family: serif, sans-serif;
  outline: none;
  cursor: pointer;
}
.easylogic-colorpicker .colorpicker-body .colorsets > .color-list {
  margin-right: 30px;
  display: block;
  padding: 12px 0px 0px 12px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  line-height: 0;
}
.easylogic-colorpicker .colorpicker-body .colorsets > .color-list h6 {
  margin-top: 0px;
  margin-bottom: 8px;
  display: none;
}
.easylogic-colorpicker
  .colorpicker-body
  .colorsets
  > .color-list
  .color-item {
  width: 13px;
  height: 13px;
  border-radius: 2px;
  display: inline-block;
  margin-right: 12px;
  margin-bottom: 12px;
  position: relative;
  background-size: contain;
  overflow: hidden;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  cursor: pointer;
  vertical-align: middle;
}
.easylogic-colorpicker
  .colorpicker-body
  .colorsets
  > .color-list
  .color-item:hover {
  -webkit-transform: scale(1.2);
  transform: scale(1.2);
}
.easylogic-colorpicker
  .colorpicker-body
  .colorsets
  > .color-list
  .color-item
  .empty {
  position: absolute;
  left: 0px;
  top: 0px;
  background-color: transparent;
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
  width: 100%;
  height: 100%;
  padding: 0px;
  margin: 0px;
  pointer-events: none;
}
.easylogic-colorpicker
  .colorpicker-body
  .colorsets
  > .color-list
  .color-item
  .color-view {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 100%;
  height: 100%;
  padding: 0px;
  margin: 0px;
  pointer-events: none;
  border: 1px solid rgba(0, 0, 0, 0.1);
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker
  .colorpicker-body
  .colorsets
  > .color-list
  .add-color-item {
  width: 13px;
  height: 13px;
  display: inline-block;
  margin-right: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  line-height: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 400;
  font-family: serif, sans-serif;
  color: #8e8e8e;
  vertical-align: middle;
}
.easylogic-colorpicker .colorpicker-body .color-chooser {
  position: absolute;
  left: 0px;
  right: 0px;
  bottom: 0px;
  top: 0px;
  opacity: 0;
  background-color: rgba(0, 0, 0, 0.5);
  -webkit-transition: opacity 0.05s ease-out;
  transition: opacity 0.05s ease-out;
  pointer-events: none;
}
.easylogic-colorpicker .colorpicker-body .color-chooser.open {
  opacity: 1;
  pointer-events: all;
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container {
  position: absolute;
  top: 120px;
  left: 0px;
  right: 0px;
  bottom: 0px;
  background-color: white;
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container
  .colorsets-item-header {
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  height: 34px;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  padding: 3px 0px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container
  .colorsets-item-header
  .title {
  -webkit-box-flex: 2;
  -ms-flex: 2;
  flex: 2;
  font-weight: bold;
  font-size: 15px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  margin-right: 30px;
  vertical-align: middle;
  margin: 0px;
  padding: 5px;
  padding-left: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #000;
  text-align: left;
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container
  .colorsets-item-header
  .items {
  -webkit-box-flex: 1;
  -ms-flex: 1;
  flex: 1;
  text-align: right;
  padding-right: 10px;
  display: block;
  height: 100%;
  line-height: 2;
  cursor: pointer;
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container
  .colorsets-list {
  position: absolute;
  top: 34px;
  left: 0px;
  right: 0px;
  bottom: 0px;
  overflow: auto;
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container
  .colorsets-list
  .colorsets-item {
  cursor: pointer;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  padding: 3px 0px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container
  .colorsets-list
  .colorsets-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container
  .colorsets-list
  .colorsets-item
  .title {
  -webkit-box-flex: 2;
  -ms-flex: 2;
  flex: 2;
  font-size: 14px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  margin-right: 30px;
  vertical-align: middle;
  pointer-events: none;
  margin: 0px;
  padding: 5px;
  padding-left: 14px;
  font-weight: normal;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #000;
  text-align: left;
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container
  .colorsets-list
  .colorsets-item
  .items {
  -webkit-box-flex: 3;
  -ms-flex: 3;
  flex: 3;
  display: block;
  height: 100%;
  line-height: 1.6;
  cursor: pointer;
  pointer-events: none;
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container
  .colorsets-list
  .colorsets-item
  .items
  .color-item {
  width: 13px;
  height: 13px;
  border-radius: 3px;
  display: inline-block;
  margin-right: 10px;
  background-color: transparent;
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
  background-size: contain;
  border: 1px solid #dddddd;
  overflow: hidden;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  cursor: pointer;
  vertical-align: middle;
}
.easylogic-colorpicker
  .colorpicker-body
  .color-chooser
  .color-chooser-container
  .colorsets-list
  .colorsets-item
  .items
  .color-item
  .color-view {
  width: 100%;
  height: 100%;
  padding: 0px;
  margin: 0px;
  pointer-events: none;
}
.easylogic-colorpicker .gradient-editor {
  position: relative;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
.easylogic-colorpicker .gradient-editor .tools {
  padding: 4px 6px;
}
.easylogic-colorpicker .gradient-editor .unit {
  display: grid;
  grid-template-columns: 1fr 50px 50px;
  grid-column-gap: 5px;
  font-size: 11px;
}
.easylogic-colorpicker .gradient-editor .unit input,
.easylogic-colorpicker .gradient-editor .unit select {
  width: 100%;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker .gradient-editor [data-editor] {
  display: none;
  margin-top: 2px;
}
.easylogic-colorpicker .gradient-editor [data-editor] > label {
  font-size: 11px;
  vertical-align: middle;
}
.easylogic-colorpicker .gradient-editor [data-editor] > label > * {
  vertical-align: middle;
}
.easylogic-colorpicker
  .gradient-editor:not([data-selected-editor*='static-gradient'])
  [data-editor='gradient'],
.easylogic-colorpicker
  .gradient-editor:not([data-selected-editor*='static-gradient'])
  [data-editor='tools'] {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='linear-gradient']
  [data-editor='angle'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='repeating-linear-gradient']
  [data-editor='angle'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='conic-gradient']
  [data-editor='angle'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='repeating-conic-gradient']
  [data-editor='angle'] {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='radial-gradient']
  [data-editor='centerX'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='radial-gradient']
  [data-editor='centerY'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='repeating-radial-gradient']
  [data-editor='centerX'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='repeating-radial-gradient']
  [data-editor='centerY'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='conic-gradient']
  [data-editor='centerX'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='conic-gradient']
  [data-editor='centerY'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='repeating-conic-gradient']
  [data-editor='centerX'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='repeating-conic-gradient']
  [data-editor='centerY'] {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='radial-gradient']
  [data-editor='radialType'],
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='repeating-radial-gradient']
  [data-editor='radialType'] {
  margin-top: 5px;
  display: grid;
  grid-template-columns: 1fr 105px;
  grid-column-gap: 2px;
}
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='radial-gradient']
  [data-editor='radialType']
  select,
.easylogic-colorpicker
  .gradient-editor[data-selected-editor='repeating-radial-gradient']
  [data-editor='radialType']
  select {
  width: 100%;
}
.easylogic-colorpicker .gradient-editor .sub-editor {
  padding: 0px 8px;
}
.easylogic-colorpicker .gradient-editor .gradient-steps {
  position: relative;
  height: 30px;
}
.easylogic-colorpicker .gradient-editor .hue-container,
.easylogic-colorpicker .gradient-editor .hue {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 4px;
  height: 14px;
  border-radius: 10px;
  border: 1px solid #cccccc;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  background-color: transparent;
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
  pointer-events: all;
}
.easylogic-colorpicker .gradient-editor .hue {
  pointer-events: none;
}
.easylogic-colorpicker .gradient-editor .hue .step-list {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0px;
  left: 0px;
  border-radius: 10px;
  pointer-events: none;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='0']
  [data-index='0'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='0']
  [data-index='0']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='1']
  [data-index='1'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='1']
  [data-index='1']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='2']
  [data-index='2'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='2']
  [data-index='2']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='3']
  [data-index='3'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='3']
  [data-index='3']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='4']
  [data-index='4'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='4']
  [data-index='4']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='5']
  [data-index='5'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='5']
  [data-index='5']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='6']
  [data-index='6'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='6']
  [data-index='6']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='7']
  [data-index='7'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='7']
  [data-index='7']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='8']
  [data-index='8'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='8']
  [data-index='8']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='9']
  [data-index='9'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='9']
  [data-index='9']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='10']
  [data-index='10'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='10']
  [data-index='10']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='11']
  [data-index='11'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='11']
  [data-index='11']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='12']
  [data-index='12'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='12']
  [data-index='12']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='13']
  [data-index='13'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='13']
  [data-index='13']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='14']
  [data-index='14'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='14']
  [data-index='14']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='15']
  [data-index='15'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='15']
  [data-index='15']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='16']
  [data-index='16'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='16']
  [data-index='16']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='17']
  [data-index='17'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='17']
  [data-index='17']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='18']
  [data-index='18'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='18']
  [data-index='18']
  .arrow {
  display: block;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='19']
  [data-index='19'] {
  border: 0px;
  -webkit-transform: translateX(-50%) translateY(calc(100%));
  transform: translateX(-50%) translateY(calc(100%));
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list[data-selected-index='19']
  [data-index='19']
  .arrow {
  display: block;
}
.easylogic-colorpicker .gradient-editor .hue .step-list .step {
  pointer-events: all;
  width: 10px;
  height: 10px;
  border: 1px solid white;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  display: inline-block;
  position: absolute;
  top: 50%;
  border-radius: 100%;
  -webkit-box-shadow: 0 0 2px 0px rgba(0, 0, 0, 0.5);
  box-shadow: 0 0 2px 0px rgba(0, 0, 0, 0.5);
  -webkit-transform: translateX(-50%) translateY(-50%);
  transform: translateX(-50%) translateY(-50%);
  background-color: transparent;
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list
  .step[data-cut='true'] {
  border-radius: 0%;
}
.easylogic-colorpicker
  .gradient-editor
  .hue
  .step-list
  .step[data-cut='true']
  .color-view {
  border-radius: 0%;
}
.easylogic-colorpicker .gradient-editor .hue .step-list .step .color-view {
  position: absolute;
  left: 0px;
  top: 0px;
  bottom: 0px;
  right: 0px;
  border-radius: 100%;
  pointer-events: none;
}
.easylogic-colorpicker .gradient-editor .hue .step-list .step .arrow {
  position: absolute;
  left: 50%;
  display: none;
  top: 0%;
  width: 5px;
  height: 5px;
  -webkit-transform: translateX(-50%) translateY(-120%);
  transform: translateX(-50%) translateY(-120%);
  pointer-events: none;
  -webkit-clip-path: polygon(40% 0%, 60% 0%, 60% 100%, 40% 100%);
  clip-path: polygon(40% 0%, 60% 0%, 60% 100%, 40% 100%);
}
.easylogic-colorpicker .gradient-editor input[type='range'] {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 100%;
  margin: 6.2px 0;
  background-color: transparent;
}
.easylogic-colorpicker .gradient-editor input[type='range']:focus {
  outline: none;
}
.easylogic-colorpicker
  .gradient-editor
  input[type='range']::-webkit-slider-runnable-track {
  width: 100%;
  height: 1px;
  cursor: pointer;
  background: #556375;
  border-radius: 0px;
  border: 0px solid #010101;
}
.easylogic-colorpicker
  .gradient-editor
  input[type='range']::-webkit-slider-thumb {
  height: 10px;
  width: 10px;
  border-radius: 10px;
  background: #556375;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  margin-top: -5px;
}
.easylogic-colorpicker
  .gradient-editor
  input[type='range']:focus::-webkit-slider-runnable-track {
  background: #3174ad;
}
.easylogic-colorpicker
  .gradient-editor
  input[type='range']::-moz-range-track {
  width: 100%;
  height: 1px;
  cursor: pointer;
  background: #556375;
  border-radius: 0px;
  border: 0px solid #010101;
}
.easylogic-colorpicker
  .gradient-editor
  input[type='range']::-moz-range-thumb {
  border: 1px solid #000000;
  height: 10px;
  width: 10px;
  border-radius: 9px;
  background: #556375;
  cursor: pointer;
}
.easylogic-colorpicker .gradient-editor input[type='range']::-ms-track {
  width: 100%;
  height: 1px;
  cursor: pointer;
  background: transparent;
  border-color: transparent;
  color: transparent;
}
.easylogic-colorpicker .gradient-editor input[type='range']::-ms-fill-lower {
  background: #556375;
  border: 0px solid #010101;
  border-radius: 0px;
  box-shadow: 0px 0px 0px #000000, 0px 0px 0px #0d0d0d;
}
.easylogic-colorpicker .gradient-editor input[type='range']::-ms-fill-upper {
  background: #556375;
  border: 0px solid #010101;
  border-radius: 0px;
}
.easylogic-colorpicker .gradient-editor input[type='range']::-ms-thumb {
  height: 10px;
  width: 10px;
  border-radius: 9px;
  background: #556375;
  cursor: pointer;
}
.easylogic-colorpicker
  .gradient-editor
  input[type='range']:focus::-ms-fill-lower {
  background: #556375;
}
.easylogic-colorpicker
  .gradient-editor
  input[type='range']:focus::-ms-fill-upper {
  background: #556375;
}
.easylogic-colorpicker .gradient-editor .right-menu {
  display: inline-block;
  float: right;
}
.easylogic-colorpicker .gradient-editor .right-menu button {
  font-size: 11px;
  background-color: transparent;
  border: 0px;
}
.easylogic-colorpicker.gradient-picker {
  width: 460px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker.gradient-picker .gradient-body {
  display: grid;
  grid-template-columns: 1fr 224px;
}
.easylogic-colorpicker.gradient-picker .gradient-body > div:first-child {
  padding: 5px;
  border-right: 1px solid #cccccc;
}
.easylogic-colorpicker.gradient-picker .popup-item {
  margin-bottom: 5px;
}
.easylogic-colorpicker.gradient-picker .grid-2 {
  display: grid;
  grid-template-columns: 60px 1fr;
}
.easylogic-colorpicker.gradient-picker .grid-2 label {
  font-size: 11px;
  padding-right: 2px;
  text-align: left;
}
.easylogic-colorpicker.gradient-picker label {
  font-size: 11px;
}
.easylogic-colorpicker.gradient-picker .gradient-preview {
  width: 100%;
  height: 100px;
  position: relative;
  margin-bottom: 5px;
  border: 1px solid #cccccc;
  border-radius: 3px;
  overflow: hidden;
  background-color: transparent;
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
}
.easylogic-colorpicker.gradient-picker .gradient-preview .gradient-view {
  position: absolute;
  left: 0px;
  top: 0px;
  right: 0px;
  bottom: 0px;
}
.easylogic-colorpicker.gradient-picker .picker-tab {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
.easylogic-colorpicker.gradient-picker .picker-tab .picker-tab-list {
  text-align: center;
  padding: 2px 5px;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='linear-gradient']
  .picker-tab-item[data-selected-value='linear-gradient'] {
  -webkit-box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
  box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='linear-gradient']
  .picker-tab-item[data-selected-value='linear-gradient']
  .icon
  svg
  path {
  fill: rgba(0, 0, 255, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='repeating-linear-gradient']
  .picker-tab-item[data-selected-value='repeating-linear-gradient'] {
  -webkit-box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
  box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='repeating-linear-gradient']
  .picker-tab-item[data-selected-value='repeating-linear-gradient']
  .icon
  svg
  path {
  fill: rgba(0, 0, 255, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='radial-gradient']
  .picker-tab-item[data-selected-value='radial-gradient'] {
  -webkit-box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
  box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='radial-gradient']
  .picker-tab-item[data-selected-value='radial-gradient']
  .icon
  svg
  path {
  fill: rgba(0, 0, 255, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='repeating-radial-gradient']
  .picker-tab-item[data-selected-value='repeating-radial-gradient'] {
  -webkit-box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
  box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='repeating-radial-gradient']
  .picker-tab-item[data-selected-value='repeating-radial-gradient']
  .icon
  svg
  path {
  fill: rgba(0, 0, 255, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='conic-gradient']
  .picker-tab-item[data-selected-value='conic-gradient'] {
  -webkit-box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
  box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='conic-gradient']
  .picker-tab-item[data-selected-value='conic-gradient']
  .icon
  svg
  path {
  fill: rgba(0, 0, 255, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='repeating-conic-gradient']
  .picker-tab-item[data-selected-value='repeating-conic-gradient'] {
  -webkit-box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
  box-shadow: 0px 0px 3px 0px rgba(0, 0, 0, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list[data-value='repeating-conic-gradient']
  .picker-tab-item[data-selected-value='repeating-conic-gradient']
  .icon
  svg
  path {
  fill: rgba(0, 0, 255, 0.5);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list
  .picker-tab-item {
  display: inline-block;
  vertical-align: middle;
  height: 20px;
  width: 20px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  cursor: pointer;
  position: relative;
  border-radius: 20%;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list
  .picker-tab-item
  .icon {
  pointer-events: none;
  border-radius: 100%;
  display: inline-block;
  width: 90%;
  height: 90%;
  position: absolute;
  left: 50%;
  top: 50%;
  -webkit-transform: translateX(-50%) translateY(-50%);
  transform: translateX(-50%) translateY(-50%);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list
  .picker-tab-item
  .icon
  svg {
  width: 100%;
  height: 100%;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list
  .picker-tab-item[data-selected-value='static-gradient']
  .icon {
  background-image: -webkit-gradient(
    linear,
    left top,
    right top,
    from(red),
    to(red)
  );
  background-image: linear-gradient(to right, red, red);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list
  .picker-tab-item[data-selected-value='linear-gradient']
  .icon {
  background-image: -webkit-gradient(
    linear,
    left top,
    right top,
    from(black),
    to(gray)
  );
  background-image: linear-gradient(to right, black, gray);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list
  .picker-tab-item[data-selected-value='radial-gradient']
  .icon {
  background-image: radial-gradient(closest-side, black, #ebf8e1, gray);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list
  .picker-tab-item[data-selected-value='conic-gradient']
  .icon {
  background-image: conic-gradient(black, #ebf8e1);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list
  .picker-tab-item[data-selected-value='repeating-linear-gradient']
  .icon {
  background-image: repeating-linear-gradient(
    45deg,
    #3f87a6,
    #ebf8e1 15%,
    #f69d3c 20%
  );
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list
  .picker-tab-item[data-selected-value='repeating-radial-gradient']
  .icon {
  background-image: repeating-radial-gradient(
    circle,
    #3f87a6,
    #ebf8e1 15%,
    #f69d3c 20%
  );
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-tab-list
  .picker-tab-item[data-selected-value='repeating-conic-gradient']
  .icon {
  background-image: repeating-conic-gradient(
    #3f87a6,
    #ebf8e1 5%,
    #f69d3c 10%
  );
}
.easylogic-colorpicker.gradient-picker .picker-tab .picker-gradient-selector {
  padding: 2px 10px;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-gradient-selector
  .gradient-steps {
  position: relative;
  display: block;
  height: 30px;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-gradient-selector
  .gradient-steps
  .hue-container {
  width: 100%;
  height: 14px;
  position: absolute;
  z-index: 0;
  background-color: transparent;
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
  -webkit-box-shadow: 0 0 1px 0 rgba(0, 0, 0, 0.1);
  box-shadow: 0 0 1px 0 rgba(0, 0, 0, 0.1);
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-gradient-selector
  .gradient-steps
  .hue {
  position: relative;
  padding: 0px;
  margin: 0px;
  cursor: pointer;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-gradient-selector
  .gradient-steps
  .hue
  > .step-list {
  position: relative;
  width: 100%;
  cursor: copy;
  height: 14px;
  z-index: 1;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-gradient-selector
  .gradient-steps
  .hue
  > .step-list.mode-drag {
  cursor: pointer;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-gradient-selector
  .gradient-steps
  .hue
  .drag-bar {
  border: 0px;
  background-color: transparent;
  border: 2px solid white;
  -webkit-box-shadow: 0 0 2px 0px rgba(0, 0, 0, 0.6);
  box-shadow: 0 0 2px 0px rgba(0, 0, 0, 0.6);
  width: 10px;
  height: 10px;
  -webkit-transform: none;
  transform: none;
  border-radius: 50%;
  display: inline-block;
  left: 0px;
  top: 17px;
  -webkit-transform: translateX(-50%);
  transform: translateX(-50%);
  position: absolute;
  background-color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  -webkit-transition: top 0.3s ease-out;
  transition: top 0.3s ease-out;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-gradient-selector
  .gradient-steps
  .hue
  .drag-bar
  .guide-line {
  pointer-events: none;
  position: absolute;
  width: 1px;
  height: 0px;
  bottom: 8px;
  left: 3px;
  -webkit-transform: translateX(-1px);
  transform: translateX(-1px);
  -webkit-transition: all 0.3s ease-out;
  transition: all 0.3s ease-out;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-gradient-selector
  .gradient-steps
  .hue
  .drag-bar.selected {
  z-index: 1;
  top: 30px;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-gradient-selector
  .gradient-steps
  .hue
  .drag-bar.selected
  .guide-line {
  height: 17px;
}
.easylogic-colorpicker.gradient-picker
  .picker-tab
  .picker-gradient-selector
  .gradient-steps
  .hue
  .drag-bar.selected
  .guide-change {
  opacity: 1;
}
.easylogic-colorpicker.gradient-picker .easylogic-colorpicker {
  width: 223px;
  border-radius: 0px;
  border-top-right-radius: 3px;
  border-bottom-right-radius: 3px;
  border: 0px;
  -webkit-box-shadow: none;
  box-shadow: none;
}
.easylogic-colorpicker.sketch {
  border-radius: 5px;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .color {
  margin: 10px 10px 2px 10px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  height: 150px;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .control {
  padding: 0px;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .control > .color,
.easylogic-colorpicker.sketch > .colorpicker-body > .control > .empty {
  position: absolute;
  right: 10px;
  left: auto;
  top: 2px;
  width: 40px;
  height: 44px;
  border-radius: 2px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .control > .color2,
.easylogic-colorpicker.sketch > .colorpicker-body > .control > .empty2 {
  position: absolute;
  right: 10px;
  left: auto;
  top: 50px;
  width: 40px;
  height: 20px;
  border-radius: 2px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .control > .color {
  -webkit-box-shadow: inset 0px 0px 1px 0px rgba(0, 0, 0, 0.5);
  box-shadow: inset 0px 0px 1px 0px rgba(0, 0, 0, 0.5);
}
.easylogic-colorpicker.sketch > .colorpicker-body > .control > .hue {
  position: relative;
  padding: 2px 2px 2px 10px;
  margin: 0px 50px 0px 0px;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .control
  > .hue
  > .hue-container {
  border-radius: 0px;
  height: 20px;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .control > .hue-scale {
  position: relative;
  padding: 2px 2px 2px 10px;
  margin: 0px 50px 0px 0px;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .control
  > .hue-scale
  > .hue-scale-container {
  border-radius: 0px;
  height: 20px;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .control > .opacity {
  position: relative;
  padding: 2px 2px 2px 10px;
  margin: 0px 50px 0px 0px;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .control
  > .opacity
  > .opacity-container {
  border-radius: 0px;
  height: 20px;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .control .drag-bar,
.easylogic-colorpicker.sketch > .colorpicker-body > .control .drag-bar2 {
  border-radius: 0px;
  top: 50%;
  left: 0px;
  width: 5px;
  height: 80%;
  -webkit-transform: translateX(-50%) translateY(-50%);
  transform: translateX(-50%) translateY(-50%);
  border-radius: 1px;
  bottom: 1px !important;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .control .drag-bar.first,
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .control
  .drag-bar2.first {
  left: 0px;
  -webkit-transform: translateX(50%) translateY(-50%) !important;
  transform: translateX(50%) translateY(-50%) !important;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .control .drag-bar.last,
.easylogic-colorpicker.sketch > .colorpicker-body > .control .drag-bar2.last {
  -webkit-transform: translateX(-110%) translateY(-50%) !important;
  transform: translateX(-110%) translateY(-50%) !important;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information
  .information-change {
  display: none;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information.rgb
  .information-item.rgb {
  display: inherit;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information.rgb
  .information-item.hsl {
  display: none !important;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information.hex
  .information-item.hex {
  display: inherit;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information.hex
  .information-item.hsl {
  display: none !important;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information.hsl
  .information-item.rgb {
  display: none !important;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information.hsl
  .information-item.hsl {
  display: inherit;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information
  .information-item {
  display: -webkit-inline-box !important;
  display: -ms-inline-flexbox !important;
  display: inline-flex !important;
  margin-right: 0px;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information
  .information-item
  > .input-field {
  padding-left: 0px;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information
  .information-item
  > .input-field:last-child {
  padding-right: 0px;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information
  .information-item
  > .input-field
  > .title {
  color: black;
  font-size: 11px;
  cursor: pointer;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information
  .information-item
  > .input-field:last-child:not(:first-child) {
  padding-right: 0px;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information
  .information-item.hex {
  width: 74px;
  padding-right: 0px;
  padding-left: 5px;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information
  .information-item.rgb {
  width: 140px;
  padding-left: 0px;
  padding-right: 0px;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .information
  .information-item.hsl {
  display: none;
  width: 140px;
  padding-left: 0px;
  padding-right: 0px;
}
.easylogic-colorpicker.sketch > .colorpicker-body > .colorsets > .color-list {
  margin-right: 0px;
  padding-right: 12px;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .colorsets
  > .color-list
  h6 {
  margin-top: 0px;
  margin-bottom: 8px;
  display: none;
}
.easylogic-colorpicker.sketch
  > .colorpicker-body
  > .colorsets
  > .color-list
  .color-item {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  margin-right: 9px;
  margin-bottom: 10px;
}
.easylogic-colorpicker.palette {
  border-radius: 3px;
  -webkit-box-shadow: none;
  box-shadow: none;
}
.easylogic-colorpicker.palette > .colorpicker-body > .color {
  display: none;
}
.easylogic-colorpicker.palette > .colorpicker-body > .control {
  display: none;
}
.easylogic-colorpicker.palette > .colorpicker-body > .information {
  display: none;
}
.easylogic-colorpicker.palette > .colorpicker-body > .colorsets {
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  border-top: 0px;
}
.easylogic-colorpicker.palette
  > .colorpicker-body
  > .colorsets
  > .color-list
  h6 {
  margin-top: 0px;
  margin-bottom: 8px;
  display: none;
}
.easylogic-colorpicker.palette
  > .colorpicker-body
  > .colorsets
  > .color-list
  .color-item {
  width: 15px;
  height: 15px;
  margin-right: 10px;
  margin-bottom: 10px;
}
.easylogic-colorpicker.palette > .colorpicker-body > .color-chooser {
  display: none;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker.palette > .colorpicker-body > .color-chooser.open {
  display: block;
  top: -1px;
  left: -1px;
  right: -1px;
  bottom: auto;
  border-radius: 3px;
  border: 1px solid #d8d8d8;
  -webkit-box-shadow: 0 0px 10px 2px rgba(0, 0, 0, 0.12);
  box-shadow: 0 0px 10px 2px rgba(0, 0, 0, 0.12);
}
.easylogic-colorpicker.palette
  > .colorpicker-body
  > .color-chooser.open
  .color-chooser-container {
  position: relative;
  top: auto;
  left: auto;
  right: auto;
  bottom: auto;
  background-color: white;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  border-radius: 2px;
}
.easylogic-colorpicker.palette
  > .colorpicker-body
  > .color-chooser.open
  .color-chooser-container
  .colorsets-item-header {
  position: relative;
  left: auto;
  top: auto;
  right: auto;
  bottom: auto;
  border-top-left-radius: 3px;
  border-top-right-radius: 3px;
}
.easylogic-colorpicker.palette
  > .colorpicker-body
  > .color-chooser.open
  .color-chooser-container
  .colorsets-list {
  position: relative;
  top: auto;
  left: auto;
  right: auto;
  bottom: auto;
  overflow: auto;
}
.easylogic-colorpicker.palette
  > .colorpicker-body
  > .color-chooser.open
  .color-chooser-container
  .colorsets-list
  .colorsets-item:last-child {
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
}
.easylogic-colorpicker.macos .colorpicker-body .wheel {
  width: 224px;
  height: 224px;
  position: relative;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker.macos .colorpicker-body .wheel .wheel-canvas {
  width: 214px;
  height: 214px;
  border-radius: 50%;
  position: absolute;
  left: 5px;
  top: 5px;
}
.easylogic-colorpicker.macos .colorpicker-body .wheel .drag-pointer {
  display: inline-block;
  position: absolute;
  width: 10px;
  height: 10px;
  left: 50%;
  top: 50%;
  border: 1px solid white;
  border-radius: 50%;
  -webkit-transform: translateX(-50%) translateY(-50%);
  transform: translateX(-50%) translateY(-50%);
  z-index: 2;
}
.easylogic-colorpicker.macos .control {
  padding-top: 0px;
}
.easylogic-colorpicker.macos .control > .color,
.easylogic-colorpicker.macos .control > .empty {
  top: 4px;
}
.easylogic-colorpicker.macos .value {
  position: relative;
  padding: 6px 16px;
  margin: 0px 0px 0px 42px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  cursor: pointer;
}
.easylogic-colorpicker.macos .value > .value-container {
  position: relative;
  width: 100%;
  height: 10px;
  border-radius: 3px;
  background-image: -webkit-gradient(
    linear,
    left top,
    right top,
    from(#000000),
    to(rgba(255, 255, 255, 0))
  );
  background-image: linear-gradient(
    to right,
    #000000 0%,
    rgba(255, 255, 255, 0) 100%
  );
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker.macos .value > .value-container .drag-bar {
  position: absolute;
  cursor: pointer;
  top: 50%;
  left: 0px;
  -webkit-transform: translateX(-50%) translateY(-50%);
  transform: translateX(-50%) translateY(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.easylogic-colorpicker.mini {
  width: 180px;
  display: inline-block;
}
.easylogic-colorpicker.mini .control {
  padding: 0px;
}
.easylogic-colorpicker.mini .control .hue,
.easylogic-colorpicker.mini .control .opacity {
  margin: 0px;
  padding: 0px;
}
.easylogic-colorpicker.mini .control .hue > .hue-container {
  border-radius: 0px;
  overflow: hidden;
  height: 20px;
}
.easylogic-colorpicker.mini .control .opacity > .opacity-container {
  border-radius: 0px;
  overflow: hidden;
  height: 20px;
}
.easylogic-colorpicker.mini .control .drag-bar,
.easylogic-colorpicker.mini .control .drag-bar2 {
  border: 0px;
  background-color: transparent;
  height: 100%;
  width: 5px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  -webkit-box-shadow: none;
  box-shadow: none;
}
.easylogic-colorpicker.mini .control .drag-bar.last:before,
.easylogic-colorpicker.mini .control .drag-bar.lastafter,
.easylogic-colorpicker.mini .control .drag-bar2.last:before,
.easylogic-colorpicker.mini .control .drag-bar2.lastafter {
  left: 1px;
}
.easylogic-colorpicker.mini .control .drag-bar.first:before,
.easylogic-colorpicker.mini .control .drag-bar.first:after,
.easylogic-colorpicker.mini .control .drag-bar2.first:before,
.easylogic-colorpicker.mini .control .drag-bar2.first:after {
  left: 3px;
}
.easylogic-colorpicker.mini .control .drag-bar:before,
.easylogic-colorpicker.mini .control .drag-bar2:before {
  content: '';
  position: absolute;
  left: 2px;
  top: 0px;
  width: 0;
  height: 0;
  -webkit-transform: translateX(-50%);
  transform: translateX(-50%);
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid black;
}
.easylogic-colorpicker.mini .control .drag-bar:after,
.easylogic-colorpicker.mini .control .drag-bar2:after {
  content: '';
  position: absolute;
  left: 2px;
  bottom: 0px;
  width: 0;
  height: 0;
  -webkit-transform: translateX(-50%);
  transform: translateX(-50%);
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid black;
}
.easylogic-colorpicker.mini-vertical {
  width: 180px;
  display: inline-block;
}
.easylogic-colorpicker.mini-vertical .color {
  display: inline-block;
  width: 140px;
  height: 160px;
  vertical-align: middle;
}
.easylogic-colorpicker.mini-vertical .control {
  height: 160px;
  padding: 0px;
  vertical-align: middle;
  display: inline-block;
}
.easylogic-colorpicker.mini-vertical .control .hue,
.easylogic-colorpicker.mini-vertical .control .opacity {
  margin: 0px;
  padding: 0px;
  width: 20px;
  display: inline-block;
  vertical-align: middle;
  height: 100%;
  position: relative;
}
.easylogic-colorpicker.mini-vertical .control .hue > .hue-container {
  border-radius: 0px;
  overflow: hidden;
  height: 100%;
  background: -webkit-gradient(
    linear,
    left bottom,
    left top,
    from(#ff0000),
    color-stop(17%, #ffff00),
    color-stop(33%, #00ff00),
    color-stop(50%, #00ffff),
    color-stop(67%, #0000ff),
    color-stop(83%, #ff00ff),
    to(#ff0000)
  );
  background: linear-gradient(
    to top,
    #ff0000 0%,
    #ffff00 17%,
    #00ff00 33%,
    #00ffff 50%,
    #0000ff 67%,
    #ff00ff 83%,
    #ff0000 100%
  );
}
.easylogic-colorpicker.mini-vertical .control .opacity > .opacity-container {
  border-radius: 0px;
  overflow: hidden;
  height: 100%;
  width: 20px;
}
.easylogic-colorpicker.mini-vertical .control .drag-bar,
.easylogic-colorpicker.mini-vertical .control .drag-bar2 {
  border: 0px;
  background-color: transparent;
  height: 2px;
  width: 100%;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  -webkit-box-shadow: none;
  box-shadow: none;
  -webkit-transform: none;
  transform: none;
}
.easylogic-colorpicker.mini-vertical .control .drag-bar.last:before,
.easylogic-colorpicker.mini-vertical .control .drag-bar.last:after,
.easylogic-colorpicker.mini-vertical .control .drag-bar2.last:before,
.easylogic-colorpicker.mini-vertical .control .drag-bar2.last:after {
  top: 2px;
}
.easylogic-colorpicker.mini-vertical .control .drag-bar.first:before,
.easylogic-colorpicker.mini-vertical .control .drag-bar.first:after,
.easylogic-colorpicker.mini-vertical .control .drag-bar2.first:before,
.easylogic-colorpicker.mini-vertical .control .drag-bar2.first:after {
  top: -1px;
}
.easylogic-colorpicker.mini-vertical .control .drag-bar:before,
.easylogic-colorpicker.mini-vertical .control .drag-bar2:before {
  content: '';
  position: absolute;
  left: 0px;
  top: 2px;
  width: 0;
  height: 0;
  -webkit-transform: translateY(-50%);
  transform: translateY(-50%);
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 4px solid black;
}
.easylogic-colorpicker.mini-vertical .control .drag-bar:after,
.easylogic-colorpicker.mini-vertical .control .drag-bar2:after {
  content: '';
  position: absolute;
  top: 2px;
  right: 0px;
  width: 0;
  height: 0;
  -webkit-transform: translateY(-50%);
  transform: translateY(-50%);
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-right: 4px solid black;
}
.easylogic-colorpicker.ring .colorpicker-body > .color {
  position: absolute;
  width: 120px;
  height: 120px;
  left: 52px;
  top: 52px;
}
.easylogic-colorpicker.ring .colorpicker-body .wheel {
  width: 224px;
  height: 224px;
  position: relative;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
}
.easylogic-colorpicker.ring .colorpicker-body .wheel .wheel-canvas {
  width: 214px;
  height: 214px;
  border-radius: 50%;
  position: absolute;
  left: 5px;
  top: 5px;
}
.easylogic-colorpicker.ring .colorpicker-body .wheel .drag-pointer {
  display: inline-block;
  position: absolute;
  width: 10px;
  height: 10px;
  left: 50%;
  top: 50%;
  border: 1px solid white;
  border-radius: 50%;
  -webkit-transform: translateX(-50%) translateY(-50%);
  transform: translateX(-50%) translateY(-50%);
  z-index: 2;
}
.easylogic-colorpicker.ring .control {
  padding-top: 0px;
}
.easylogic-colorpicker.ring .control .value {
  display: none;
}
.easylogic-colorpicker.ring .control > .color,
.easylogic-colorpicker.ring .control > .empty {
  top: -17px;
  width: 30px;
  height: 30px;
  border-radius: 2px;
}
.easylogic-colorpicker.xd {
  display: inline-block;
  padding-top: 12px;
  width: 245px;
}
.easylogic-colorpicker.xd .color {
  display: inline-block;
  margin-left: 12px;
  margin-bottom: 12px;
  width: 170px;
  height: 170px;
  vertical-align: middle;
  border-radius: 3px;
  overflow: hidden;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  border: 1px solid #cecece;
}
.easylogic-colorpicker.xd .color > .saturation > .value > .drag-pointer {
  border: 2px solid white;
  width: 7px;
  height: 7px;
  -webkit-box-shadow: 0 0 1px 0px black, inset 0 0 1px 0px black;
  box-shadow: 0 0 1px 0px black, inset 0 0 1px 0px black;
}
.easylogic-colorpicker.xd .control {
  height: 170px;
  padding: 0px;
  vertical-align: middle;
  display: inline-block;
  margin-right: 12px;
  margin-bottom: 12px;
}
.easylogic-colorpicker.xd .control .hue,
.easylogic-colorpicker.xd .control .opacity {
  margin: 0px;
  padding: 0px;
  width: 13px;
  display: inline-block;
  vertical-align: middle;
  height: 100%;
  position: relative;
  overflow: hidden;
  border-radius: 3px;
  margin-left: 8px;
}
.easylogic-colorpicker.xd .control .hue > .hue-container {
  border-radius: 0px;
  overflow: hidden;
  height: 100%;
  background: -webkit-gradient(
    linear,
    left bottom,
    left top,
    from(#ff0000),
    color-stop(17%, #ffff00),
    color-stop(33%, #00ff00),
    color-stop(50%, #00ffff),
    color-stop(67%, #0000ff),
    color-stop(83%, #ff00ff),
    to(#ff0000)
  );
  background: linear-gradient(
    to top,
    #ff0000 0%,
    #ffff00 17%,
    #00ff00 33%,
    #00ffff 50%,
    #0000ff 67%,
    #ff00ff 83%,
    #ff0000 100%
  );
}
.easylogic-colorpicker.xd .control .opacity > .opacity-container {
  border-radius: 0px;
  overflow: hidden;
  height: 100%;
}
.easylogic-colorpicker.xd .control .drag-bar,
.easylogic-colorpicker.xd .control .drag-bar2 {
  border: 0px;
  background-color: transparent;
  border: 2px solid white;
  -webkit-box-shadow: 0 0 1px 0px black, inset 0 0 1px 0px black;
  box-shadow: 0 0 1px 0px black, inset 0 0 1px 0px black;
  width: 10px;
  height: 10px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  -webkit-transform: none;
  transform: none;
  overflow: hidden;
  left: 50%;
  -webkit-transform: translateX(-50%) translateY(-50%);
  transform: translateX(-50%) translateY(-50%);
}
.easylogic-colorpicker.xd .information {
  margin-top: 5px;
}
.easylogic-colorpicker.vscode {
  width: 336px;
  display: inline-block;
  background-color: #333;
  border: 1px solid #ececec;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  border-radius: 0px;
}
.easylogic-colorpicker.vscode .colorpicker-body {
  border-radius: 0px;
  display: inline-block;
}
.easylogic-colorpicker.vscode .colorpicker-body .color-view {
  height: 34px;
  background-color: transparent;
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
}
.easylogic-colorpicker.vscode
  .colorpicker-body
  .color-view
  .color-view-container {
  line-height: 34px;
  font-size: 14px;
  text-align: center;
  width: 100%;
  height: 100%;
  cursor: pointer;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  text-shadow: 0 0 3px #535353;
}
.easylogic-colorpicker.vscode .colorpicker-body .color-tool {
  padding: 8px;
}
.easylogic-colorpicker.vscode .color {
  display: inline-block;
  width: 240px;
  height: 160px;
  vertical-align: middle;
}
.easylogic-colorpicker.vscode .control {
  height: 160px;
  vertical-align: middle;
  display: inline-block;
  padding: 0px 0px 0px 4px;
}
.easylogic-colorpicker.vscode .control .hue,
.easylogic-colorpicker.vscode .control .opacity {
  margin: 0px;
  padding: 0px;
  width: 30px;
  display: inline-block;
  vertical-align: middle;
  height: 100%;
  position: relative;
}
.easylogic-colorpicker.vscode .control .hue {
  padding-left: 5px;
  width: 35px;
}
.easylogic-colorpicker.vscode .control .hue > .hue-container {
  border-radius: 0px;
  height: 100%;
  background: -webkit-gradient(
    linear,
    left bottom,
    left top,
    from(#ff0000),
    color-stop(17%, #ffff00),
    color-stop(33%, #00ff00),
    color-stop(50%, #00ffff),
    color-stop(67%, #0000ff),
    color-stop(83%, #ff00ff),
    to(#ff0000)
  );
  background: linear-gradient(
    to top,
    #ff0000 0%,
    #ffff00 17%,
    #00ff00 33%,
    #00ffff 50%,
    #0000ff 67%,
    #ff00ff 83%,
    #ff0000 100%
  );
}
.easylogic-colorpicker.vscode .control .opacity > .opacity-container {
  border-radius: 0px;
  height: 100%;
  width: 30px;
}
.easylogic-colorpicker.vscode .control .drag-bar,
.easylogic-colorpicker.vscode .control .drag-bar2 {
  background-color: transparent;
  height: 5px;
  width: 33px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  -webkit-box-shadow: none;
  box-shadow: none;
  -webkit-transform: translateY(-50%) translateX(-2px);
  transform: translateY(-50%) translateX(-2px);
  border: 1px solid rgba(255, 255, 255, 0);
  border-radius: 0px;
  -webkit-box-shadow: 0 0 2px 0 black, inset 0 0 0 0 black;
  box-shadow: 0 0 2px 0 black, inset 0 0 0 0 black;
}
.easylogic-colorpicker.hide-colorsets .colorsets {
  display: none !important;
}

.colorsets-contextmenu {
  position: fixed;
  padding-top: 4px;
  padding-bottom: 4px;
  border-radius: 6px;
  background-color: #ececec;
  border: 1px solid #cccccc;
  display: none;
  list-style: none;
  font-size: 13px;
  padding-left: 0px;
  padding-right: 0px;
}
.colorsets-contextmenu.show {
  display: inline-block;
}
.colorsets-contextmenu .menu-item {
  padding: 2px 20px;
  cursor: default;
}
.colorsets-contextmenu .menu-item:hover {
  background-color: #5ea3fb;
  color: white;
}
.colorsets-contextmenu.small .menu-item.small-hide {
  display: none;
}
`;

export function createColorPickerStyle() {
  const style = document.createElement('style');
  style.textContent = colorPicker;
  return style;
}
