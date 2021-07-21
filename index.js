const Imap = require("imap");

class GmailImap {
  imap;
  isReady;
  bodies = "HEADER.FIELDS (FROM TO SUBJECT DATE)";
  inbox;

  constructor(email, password) {
    this.imap = new Imap({
      user: email, password,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { servername: "imap.gmail.com" }
    });
  }

  async connect() {
    this.imap.once("ready", () => {
      this.isReady = true
    });
    this.imap.connect();
    wait(5000).then(() =>
    {
      if (!this.isReady) {
        throw new Error("Connection timeout");
      }
    });
    while (!this.isReady) {
      await wait(300);
    }
    return true;
  }

  async openInbox() {
    return new Promise((resolve, reject) => {
      this.imap.openBox("INBOX", true, (err, inbox) => {
        if (err)
          reject(err)
        else {
          this.inbox = inbox;
          resolve(inbox);
        }
      });
    });
  }

  async getMails(source) {
    return new Promise((resolve, reject) => {
      const messages = this.imap.seq.fetch(source, {struct: true, bodies: this.bodies });
      const parsedEmails = [];
      messages.on("message", (message, seqno) => {
        message.on("body", (stream, info) => {
          let buffer = "";
          stream.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
          });
          stream.once("end", () => {
            parsedEmails.push(Imap.parseHeader(buffer));
          });
        });
      });
      messages.once("error", reject);
      messages.once("end", () => {
        resolve(parsedEmails);
      });
    });
  }

  waitForEmail() {
    return new Promise(async(resolve, reject) => {
      let received = false;
      this.imap.on("mail", async() => {
        received = true;
        const result = await this.getMails(this.inbox.uidnext);
        if (result.length)
          resolve(result[0]);
      });

      wait(15000).then(() => {
        received = true;
        reject("Timeout");
      });
      while (!received) {
        await wait(300);
      }
    });
  }

  end() {
    this.imap.end();
  }
}

function wait(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

(async() =>
{
  const gmailImap = new GmailImap(process.env.USER_EMAIL, process.env.USER_PASSWORD);
  await gmailImap.connect();
  await gmailImap.openInbox();
  console.log(await gmailImap.getMails("1:*"));
  // const email = await gmailImap.waitForEmail();
  // console.log(email.subject);
  await gmailImap.end();
})()
