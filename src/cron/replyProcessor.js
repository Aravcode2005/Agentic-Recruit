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

const parseCandidateReply =
  require(
    '../services/aiService'
  );

const qualifies = require(
  '../services/qualificationService'
);

const BOOKING_LINK =
  process.env.BOOKING_LINK;

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
        'Reply processor already running'
      );

      return;
    }

    isRunning = true;

    try {
      console.log(
        'Checking candidate replies...'
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

          if (!rawFrom) {
            await markAsRead(
              email.id
            );

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
            'Processing:',
            from
          );
          const blockedSenders = [
            'no-reply',
            'mailer-daemon',
            'google',
            'pinterest',
            'groww',
            'linkedin',
            'naukri',
            'codingninjas',
            'wps'
          ];
          const isSystemMail =
            blockedSenders.some(
              sender =>
                from
                  .toLowerCase()
                  .includes(sender)
            );

          if (
            isSystemMail ||
            from ===
              process.env.EMAIL_USER
          ) {
            console.log(
              'Skipped system email'
            );

            await markAsRead(
              email.id
            );
            continue;
          }
          const existingCandidate =
            await Candidate.findOne({
              email: from,
              stage:
                'SCREENING_SENT'
            });

          if (
            !existingCandidate
          ) {
            await markAsRead(
              email.id
            );

            continue;
          }

      
          
          const body =
            extractBody(
              msg.payload
            ) ||
            msg.snippet ||
            '';

          const lowerBody =
            body.toLowerCase();

         
          const looksLikeScreeningReply =
            lowerBody.includes(
              'visa'
            ) ||
            lowerBody.includes(
              'location'
            ) ||
            lowerBody.includes(
              'opt'
            ) ||
            lowerBody.includes(
              'cpt'
            ) ||
            lowerBody.includes(
              'f1'
            ) ||
            lowerBody.includes(
              'stem'
            ) ||
            lowerBody.includes(
              'texas'
            ) ||
            lowerBody.includes(
              'dallas'
            );

          if (
            !looksLikeScreeningReply
          ) {
            console.log(
              'Skipping non-screening reply'
            );

            await markAsRead(
              email.id
            );

            continue;
          }


          const parsed =
            await parseCandidateReply(
              body
            );

          console.log(
            'Parsed Candidate:',
            parsed
          );

          const missingCriticalFields =
            !parsed.location ||
            !parsed.visa_status;

          if (
            missingCriticalFields
          ) {
            existingCandidate.stage =
              'NEEDS_REVIEW';

            await existingCandidate.save();

            console.log(
              'Needs manual review:',
              from
            );

            await markAsRead(
              email.id
            );

            continue;
          }


          const qualified =
            qualifies(parsed);

          if (qualified) {
            await sendEmail(
              from,
              'Interview Booking',
              `
Thanks for your details.

Kindly book your slot so we can discuss further opportunities.

${BOOKING_LINK}
`
            );

            existingCandidate.name =
              parsed.full_name;

            existingCandidate.location =
              parsed.location;

            existingCandidate.visaStatus =
              parsed.visa_status;

            existingCandidate.usArrivalDate =
              parsed.arrival_date;

            existingCandidate.qualified =
              true;

            existingCandidate.stage =
              'BOOKING_SENT';
            await existingCandidate.save();
            console.log(
              'Booking link sent:',
              from
            );
          } else {
            existingCandidate.qualified =
              false;
            existingCandidate.stage =
              'REJECTED';
            await existingCandidate.save();

            console.log(
              'Candidate rejected:',
              from
            );
          }
          await markAsRead(
            email.id
          );
        } catch (err) {
          console.log(
            'Reply processor failed:',
            err.message
          );
          try {
            await markAsRead(
              email.id
            );
          } catch {}
        }
      }
    } catch (err) {
      console.log(
        'Reply cron failed:',
        err.message
      );
    } finally {
      isRunning = false;
    }
  }
);