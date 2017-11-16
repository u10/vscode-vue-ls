interface IVSCodeContributes {
  grammars: [
    {
      language: string,
      path: string,
      embeddedLanguages: {
        [key: string]: string
      }
    }
  ]
}
