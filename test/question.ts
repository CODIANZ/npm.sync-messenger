import * as readline from "readline";
import { Observable } from "rxjs";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

export function question(query: string) {
  return new Observable<string>((o) => {
    rl.question(query, (ans) => {
      o.next(ans);
      o.complete();
    });
    rl.on("close", () => {
      o.complete();
    });
  });
}

export function closeQuestion() {
  rl.close();
}
