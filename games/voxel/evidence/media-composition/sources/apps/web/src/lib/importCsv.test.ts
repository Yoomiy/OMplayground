import { describe, expect, it } from "vitest";
import { parseImportCsv } from "./importCsv";
import { parseImportGender } from "../../../../supabase/functions/import-bulk-kids/gender";
import { CLASS_GRADES, parseImportGrade } from "../../../../supabase/functions/_shared/grades";
import { parseImportRole } from "../../../../supabase/functions/import-bulk-kids/role";

describe("bulk import grade", () => {
  it.each(CLASS_GRADES)("preserves grade %s", (value) => {
    expect(parseImportGrade(value)).toBe(value);
  });

  it.each(CLASS_GRADES.map((grade, index) => [index, grade] as const))(
    "maps numeric grade %s to %s", (number, grade) => {
      expect(parseImportGrade(number)).toBe(grade);
      expect(parseImportGrade(String(number))).toBe(grade);
    }
  );

  it.each(["א'", "א׳", 'א"', " א ", "כיתה א"])("accepts common formatting: %s", (value) => {
    expect(parseImportGrade(value)).toBe("א");
  });

  it.each([undefined, null, "", " ", "unknown", "י", "10", 10, 1.5, {}, "א'ב"])(
    "rejects invalid grade %s instead of defaulting to א", (value) => {
      expect(parseImportGrade(value)).toBeNull();
    }
  );
});

describe("bulk import role", () => {
  it.each(["teacher", "Teacher", " TEACHER "])("preserves teacher role: %s", (value) => {
    expect(parseImportRole(value)).toBe("teacher");
  });

  it.each([undefined, null, "", " ", "kid", "Kid", " KID "])("uses kid for optional or kid role: %s", (value) => {
    expect(parseImportRole(value)).toBe("kid");
  });

  it.each(["admin", "student", "teachre", 1, {}])("rejects unsupported role %s", (value) => {
    expect(parseImportRole(value)).toBeNull();
  });
});

describe("bulk import gender", () => {
  it.each(["girl", "Girl", " GIRL ", "female", "Female", "f", "F", "בת", "נקבה"])("imports %s as girl", (value) => {
    expect(parseImportGender(value)).toBe("girl");
  });

  it.each(["boy", "Boy", " BOY ", "male", "Male", "m", "M", "בן", "זכר"])("imports %s as boy", (value) => {
    expect(parseImportGender(value)).toBe("boy");
  });

  it.each(["", " ", "unknown", "girls", undefined, null, 1, {}, '"girl"'])("rejects unsupported gender %s", (value) => {
    expect(parseImportGender(value)).toBeNull();
  });
});

describe("CSV import", () => {
  it("preserves gender with quoted headers, commas, and escaped quotes", () => {
    const [header, row] = parseImportCsv('\uFEFF"username","password","full_name","gender","grade"\r\n"test","secret","Last, First ""Nickname""","girl","1"\r\n');
    expect(header).toEqual(["username", "password", "full_name", "gender", "grade"]);
    expect(row).toEqual(["test", "secret", 'Last, First "Nickname"', "girl", "1"]);
    expect(parseImportGender(row[header.indexOf("gender")])).toBe("girl");
  });

  it("supports plain cells, blank lines, CRLF, and quoted newlines", () => {
    expect(parseImportCsv('username,gender\r\n\r\n test, בת \r\n"two\nlines",boy')).toEqual([
      ["username", "gender"], ["test", "בת"], ["two\nlines", "boy"]
    ]);
  });

  it("keeps empty gender cells for server rejection", () => {
    expect(parseImportCsv("username,gender\ntest,")).toEqual([["username", "gender"], ["test", ""]]);
  });

  it.each(['test,"girl', 'test,"girl"extra', 'test,gi"rl'])("rejects malformed CSV: %s", (csv) => {
    expect(() => parseImportCsv(csv)).toThrow();
  });
});
