const cron = require('node-cron');

const Candidate = require(
  '../models/Candidate'
);

const {
  getUnreadEmails,
  getMessage,
  sendEmail,
  markAsRead
} = require(
  '../services/gmailService'
);

const SCREENING_MESSAGE = `
Please share the below details:
 1.Full Name:
 2.Current Location:
 3 Visa Status:
 4.When did you come to the US?:
 5.Are you looking for marketing services?:
`;
let isRunning = false;

function extractBody(payload) {
  if (!payload) return '';

  if (payload.body?.data) {
    return Buffer.from(
      payload.body.data,
      'base64'
    ).toString();
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text =
        extractBody(part);

      if (text) return text;
    }
  }

  return '';
}

cron.schedule(
  '*/2 * * * *',
  async () => {
    if (isRunning) {
      console.log(
        'Email scanner already running'
      );

      return;
    }

    isRunning = true;

    try {
      console.log(
        'Scanning inbox...'
      );

      const emails =
        await getUnreadEmails();

      console.log(
        'Emails found:',
        emails.length
      );

      for (const email of emails) {
        try {
          const msg =
            await getMessage(email.id);

          const headers =
            msg.payload.headers;

          const rawFrom =
            headers.find(
              h =>
                h.name === 'From'
            )?.value;

          const subject =
            headers.find(
              h =>
                h.name ===
                'Subject'
            )?.value || '';

          if (!rawFrom) {
            continue;
          }

          const emailMatch =
            rawFrom.match(
              /<(.+?)>/
            );

          const from =
            emailMatch
              ? emailMatch[1]
              : rawFrom;

          console.log(
            'Checking:',
            from
          );
          if (
            from.includes(
              'no-reply'
            ) ||
            from.includes(
              'mailer-daemon'
            ) ||
            from.includes(
              'google'
            ) ||
            from.includes(
              'pinterest'
            ) ||
            from.includes(
              'groww'
            ) ||
            from.includes(
              'unstop'
            )
            || from.includes(
              'naukri'
            ),
            from ===
            process.env
              .EMAIL_USER
          ) {
            await markAsRead(
              email.id
            );
            console.log(
              'Skipped system email'
            );

            continue;
          }
          const body =
            extractBody(
              msg.payload
            ) || msg.snippet || '';

          const lowerSubject =
            subject.toLowerCase();

          const lowerBody =
            body.toLowerCase();

          const looksLikeApplication =
            lowerSubject.includes(
              'resume'
            ) ||
            lowerSubject.includes(
              'application'
            ) ||
            lowerSubject.includes(
              'job'
            ) ||
            lowerBody.includes(
              'resume'
            ) ||
            lowerBody.includes(
              'developer'
            ) ||
            lowerBody.includes(
              'engineer'
            ) ||
            lowerBody.includes(
              'cv'
            ) || lowerBody.includes(
              'applying'
            ) || lowerBody.includes(
              'experience'
            ) || lowerBody.includes(
              'internship'
            ) || lowerBody.includes(
              'portfolio'
            );
          if (
            !looksLikeApplication
          ) {
            console.log(
              'Not a job application'
            );

            await markAsRead(
              email.id
            );

            continue;
          }

          const existing =
            await Candidate.findOne({
              threadId:
                msg.threadId
            });

          if (existing) {
            await markAsRead(
              email.id
            );

            continue;
          }

          await sendEmail(
            from,
            'Candidate Screening',
            SCREENING_MESSAGE
          );

          await Candidate.create({
            email: from,
            stage:
              'SCREENING_SENT',
            threadId:
              msg.threadId
          });

          await markAsRead(
            email.id
          );

          console.log(
            'Screening sent:',
            from
          );
        } catch (error) {
          console.log(
            'Scanner item failed:',
            error
          );
        }
      }
    } catch (err) {
      console.log(
        'Scanner failed:',
        err.message
      );
    } finally {
      isRunning = false;
    }
  }
);