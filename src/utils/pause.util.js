import readline from 'readline';

export class PauseUtil {
  static async waitForEnter(message = 'Press Enter to continue...') {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`\n⏸️  ${message}\n`, () => {
        rl.close();
        resolve();
      });
    });
  }
}
