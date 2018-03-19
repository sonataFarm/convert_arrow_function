'use babel';

import ConvertArrowFunctionBView from './convert-arrow-function-view';
import { CompositeDisposable } from 'atom';
const balanced = require('balanced-match');

class Converter {
  static CLOSING_BRACKET_CHARS = {
    '{': '}',
    '(': ')'
  };

  static BRACKET_CONVERSIONS = {
    '(': '{',
    ')': '}',
    '{': '(',
    '}': ')'
  };

  constructor(methodText) {
    this.methodText = methodText;
  }

  convert() {
    const methodText = this.methodText;
    const arrowBracketMatch = methodText.match(/=>\s?({|\()/);
    if (!arrowBracketMatch) return methodText;
    const openBracketChar = arrowBracketMatch[1];
    // TODO: handle one-line return statement

    const openBracketIdx =
      arrowBracketMatch.index + arrowBracketMatch[0].length - 1;
    const closeBracketIdx =
      balanced.range(
        openBracketChar,
        this.constructor.CLOSING_BRACKET_CHARS[openBracketChar],
        methodText.substr(openBracketIdx)
      )[1] + openBracketIdx;
    const bodyStartIdx =
      methodText.substr(openBracketIdx).indexOf('\n') + openBracketIdx + 1;
    const bodyEndIdx =
      methodText.substr(0, closeBracketIdx).lastIndexOf('\n');

    const
      prefix = methodText.substr(0, bodyStartIdx).trim().replace()
      body = methodText.slice(bodyStartIdx, bodyEndIdx + 1),
      postfix = methodText.substr(bodyEndIdx + 1);

    const convertedPrefix = this.convertPrefix(prefix);
    const convertedBody = this.convertBody(body);
    const convertedPostfix = this.convertPostfix(postfix);

    return [convertedPrefix, convertedBody, convertedPostfix].join('\n');
  }

  convertBody(body) {
    let lines = body.split('\n').filter(line => line);

    let outerWhitespace = lines[0].match(/^\s*/);

    if (body.match(/\Wreturn\ /)) {
      // convert explicit => implicit
      const returnLine = lines.findIndex(line => line.match(/\Wreturn\ /));

      const preReturnLines = lines.slice(0, returnLine).map(
        line => '// ' + line
      );

      let returnLines = lines.slice(returnLine);
      if (returnLines.length > 1) {
        returnLines = returnLines.slice(1, returnLines.length - 1).map(
          line => line.substr(2)
        );
      } else {
        returnLines[0] = returnLines[0].replace(/\W(return) /, ' ');
        const last = returnLines.length - 1;
        returnLines[last] = returnLines[last].replace(/;[^;]*$/, '')
      }

      lines = [...preReturnLines, ...returnLines];

    } else {
      // convert implicit => explicit
      if (lines.length > 1) {
        const firstLine = outerWhitespace + 'return (';
        const middleLines = lines.map(line => '  ' + line);
        const lastLine = outerWhitespace + ');';

        lines = [firstLine, ...middleLines, lastLine];
      } else {
        let line = lines[0];
        const leadingWhitespace = line.match(/^\s*/);
        lines = [
          leadingWhitespace + 'return' +
          line.substr(leadingWhitespace.length) + ';'
        ];
      }
    }

    return lines.join('\n');
  }

  convertPrefix(prefix) {
    return prefix.slice(0, -1) + this.constructor.BRACKET_CONVERSIONS[prefix.slice(-1)]
  };

  convertPostfix(postfix) {
    const convertBracket = (match, p1) => this.constructor.BRACKET_CONVERSIONS[p1];
    return postfix.replace(/^[^}\)]*(}|\))/, convertBracket);
  }
}

export default {

  convertArrowFunctionBView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.convertArrowFunctionBView = new ConvertArrowFunctionBView(state.convertArrowFunctionBViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.convertArrowFunctionBView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'convert-arrow-function:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.convertArrowFunctionBView.destroy();
  },

  serialize() {
    return {
      convertArrowFunctionBViewState: this.convertArrowFunctionBView.serialize()
    };
  },

  toggle() {
    console.log('hey');
    let editor;
    if (editor = atom.workspace.getActiveTextEditor()) {
      let selection = editor.getSelectedText();
      console.log(new Converter(selection).convert());
    }
  }
};
