// import { emailSender } from "wasp/server/email";
// import { render } from "@react-email/render";
// import React from "react";
// import { UserInvitationEmail } from "../emails/templates/UserInvitationEmail";

// type InvitationEmailData = {
//   email: string;
//   invitationToken: string;
//   organizationName?: string;
//   role: string;
//   inviterName?: string;
// };

// export async function sendInvitationEmail(data: InvitationEmailData) {
//   const { email, invitationToken, organizationName, role, inviterName } = data;

//   // Create the invitation URL
//   const invitationUrl = `${
//     process.env.WASP_WEB_CLIENT_URL || "https://localhost:3000"
//   }/invitation/${invitationToken}`;

//   const organizationText = organizationName || "Lemonode";
//   const inviterText = inviterName || "Twój administrator";

//   const subject = `Zostałeś zaproszony do dołączenia do ${organizationText}`;

//   const textContent = `
//     Zostałeś zaproszony przez ${inviterText} do dołączenia do ${organizationText} jako ${role
//       .toLowerCase()
//       .replace("_", " ")}.
    
//     Kliknij link poniżej, aby utworzyć swoje konto i rozpocząć pracę:
//     ${invitationUrl}
    
//     To zaproszenie wygaśnie w ciągu 7 dni.
    
//     Jeśli masz jakieś pytania, skontaktuj się ze swoim administratorem.
//   `;

//   // Use the React email template for professional rendering
//   const html = await render(
//     React.createElement(UserInvitationEmail, {
//       inviterName: inviterText,
//       organizationName: organizationText,
//       invitationLink: invitationUrl,
//       expiresIn: "7 dni",
//     }),
//   );

//   try {
//     await emailSender.send({
//       to: email,
//       subject: subject,
//       text: textContent,
//       html,
//     });

//     return { success: true };
//   } catch (error) {
//     console.error("Failed to send invitation email:", error);
//     return {
//       success: false,
//       error: error instanceof Error ? error.message : "Unknown error",
//     };
//   }
// }
