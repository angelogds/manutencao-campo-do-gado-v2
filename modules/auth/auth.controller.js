const { authenticate } = require('./auth.service');

exports.loginForm = (req, res) => {
  res.render('auth/login');
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  const user = authenticate(email, password);

  if (!user) {
    req.flash('error', 'Usuário ou senha inválidos');
    return res.redirect('/login');
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    role: user.role
  };

  res.redirect('/dashboard');
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
