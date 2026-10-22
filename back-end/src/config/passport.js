import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { query } from './connection.js';

// Local strategy: authenticate with email + password (sent as JSON body)
passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const [user] = await query(
          'SELECT * FROM users WHERE email = $1',
          [email],
        );
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        const matches = await bcrypt.compare(password, user.password_hash);
        if (!matches) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        // Never put the hash on the session object
        return done(null, { id: user.id, name: user.name, email: user.email });
      } catch (err) {
        return done(err);
      }
    },
  ),
);

// Session stores only the user id
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const [user] = await query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [id],
    );
    return done(null, user ?? false);
  } catch (err) {
    return done(err);
  }
});

export default passport;
