/**
 * Registry of every screen by name (the names used with ctx.nav.push/reset).
 */

import { intro } from './intro.js?v=1.2.8';
import { signupName, signupMajor, signupUniversity, signupBot } from './signup.js?v=1.2.8';
import { board } from './board.js?v=1.2.8';
import { newRequest, newRequestEnd } from './new-request.js?v=1.2.8';
import { myRequests } from './my-requests.js?v=1.2.8';
import { myOffers } from './my-offers.js?v=1.2.8';
import { offerForm } from './offer-form.js?v=1.2.8';
import { invite } from './invite.js?v=1.2.8';
import { contact } from './contact.js?v=1.2.8';
import { settings } from './settings.js?v=1.2.8';
import { banned } from './banned.js?v=1.2.8';
import { request } from './request.js?v=1.2.8';

export const SCREENS = {
  intro,
  signupName,
  signupMajor,
  signupUniversity,
  signupBot,
  board,
  newRequest,
  newRequestEnd,
  myRequests,
  myOffers,
  offerForm,
  invite,
  contact,
  settings,
  banned,
  request,
};
