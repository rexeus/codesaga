import { Schema } from "effect";

/** The repository's config file is not valid JSON, has an unknown key, or has an invalid value. */
export class ConfigInvalid extends Schema.TaggedError<ConfigInvalid>()(
  "ConfigInvalid",
  {
    file: Schema.String,
    /** One line per offending key path, such as `include[0]: Expected string`. */
    problems: Schema.Array(Schema.String),
  },
) {}
