module.exports = {
  content: ["./pages/**/*.tsx", "./components/**/*.tsx"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        mediumslateblue: "#4845D2",
        primary: "#0B6BCB",
      },
      backgroundImage: {
        main: "url('./public/transparent_background.svg')",
      },
    },
  },
};
