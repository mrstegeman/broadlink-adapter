'use strict';
/**
 * `learncode` type prompt
 */

const cliCursor = require('cli-cursor');
const chalk = require('chalk');
const Base = require('inquirer/lib/prompts/base');
const observe = require('inquirer/lib/utils/events');

class LearncodePrompt extends Base {
  constructor(questions, rl, answers) {
    super(questions, rl, answers);

    if (!(this.answers && this.answers.mac) && !this.opt.mac) {
      this.throwParamError('mac');
    }

    this.mac = (this.answers && this.answers.mac) || this.opt.mac;

    if (!this.opt.broadlinkManager) {
      this.throwParamError('broadlinkManager');
    }
  }

  /**
   * Start the Inquiry session
   * @param  {Function} cb      Callback when prompt is done
   * @return {this}
   */

  _run(cb) {
    this.done = cb;

    const mac = this.mac;
    const broadlinkManager = this.opt.broadlinkManager;

    broadlinkManager.stopLearning();

    // Once user confirm (enter key)
    var events = observe(this.rl);
    var submit = events.line.map(this.getCurrentValue.bind(this));

    var validation = this.handleSubmitEvents(submit);
    validation.success.forEach(this.onEnd.bind(this));
    validation.error.forEach(this.onError.bind(this));

    // Init
    cliCursor.hide();
    this.render();

    return this;
  }

  /**
   * Render the prompt to screen
   * @return {LearncodePrompt} self
   */

  render(error) {
    var bottomContent = '';
    var message = this.getQuestion();
    const broadlinkManager = this.opt.broadlinkManager;
    const mac = this.mac;

    if (this.status === 'answered') {
      message += chalk.cyan(this.answer);
    } else if (this.learncode) {
      message += chalk.cyan(this.learncode);
    }

    if (broadlinkManager.state == 'learning') {
      bottomContent += chalk.cyan('>> ') + 'Point the remote control toward broadlink(' + mac + ') and press the button.\n';
    } else {
      bottomContent += chalk.cyan('>> ') + 'Wait for broadlink device:' + mac + ' to enter learning mode.\n';

      this.codeListener = this.onLearn.bind(this);
      this.stateListener = this.onState.bind(this);

      broadlinkManager.on('code', this.codeListener);
      broadlinkManager.on('state', this.stateListener);

      broadlinkManager.startLearning(mac, true);
    }

    bottomContent += chalk.cyan('>> ') + 'If you are OK with the above IR code, then press the enter key.';

    if (error) {
      bottomContent += chalk.red('>> ') + error;
    }

    this.screen.render(message, bottomContent);
  }

  /**
   * When user press `enter` key
   */
  getCurrentValue() {
    return this.learncode;
  }

  onEnd(state) {
    this.answer = state.value;
    this.status = 'answered';

    // Re-render prompt
    this.render();

    cliCursor.show();
    this.screen.done();
    this.done(state.value);
  }

  onError(state) {
    this.render(state.isValid);
  }

  /**
   * When enter learning mode
   */
  onState(state) {

    if (state == 'pending') {
      broadlinkManager.removeListener('code', this.codeListener);
      broadlinkManager.removeListener('state', this.stateListener);
    }

    this.render();
  }

  /**
   * When learned IR code
   */
  onLearn(code) {
    this.learncode = code;
    this.render();
  }
}

module.exports = LearncodePrompt;